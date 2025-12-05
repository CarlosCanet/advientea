import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDay } from "./dal-day";

export type TeaWithDayAndCompleteStory = Prisma.TeaGetPayload<{ include: { day: true, story: { include: { images: true } } } }>;
export type TeaWithDay = Prisma.TeaGetPayload<{ include: { day: true } }>;

export async function getTea(id: string): Promise<TeaWithDayAndCompleteStory>;
export async function getTea(day: number, year?: number): Promise<TeaWithDayAndCompleteStory>;

export async function getTea(idOrDay: string | number, year: number = 2025): Promise<TeaWithDayAndCompleteStory | null> {
  if (typeof idOrDay === "string") {
    const tea = await prisma.tea.findUnique({
      where: { id: idOrDay },
      include: { day: true, story: { include: { images: true } } }
    });
    if (!tea) return null;
    return tea;
  }
  const day = idOrDay;
  const dayResponse = await getDay(day, year);
  if (!dayResponse || !dayResponse.tea) return null;
  const teaResponse = await prisma.tea.findUnique({
    where: { id: dayResponse.tea.id },
    include: { day: true, story: { include: { images: true } } }
  });
  if (!teaResponse) return null;
  return teaResponse;
}

export async function getAllTeas(year: number): Promise<TeaWithDayAndCompleteStory[]> {
  const teas = await prisma.tea.findMany({
    where: { day: { year } },
    include: { day: true, story: { include: { images: true } } },
  });
  return teas;
}

export async function getUsernameAssignedToTea(id: string): Promise<string | null> {
  const tea = await prisma.tea.findUnique({
    where: { id },
    select: { day: { select: { assignment: { select: { user: { select: { username: true } }, guestName: true } } } } }
  });
  const assignment = tea?.day?.assignment;
  if(!assignment) return null
  return assignment.guestName ?? assignment.user?.username ?? null;
}

export async function addTea(data: Prisma.TeaCreateWithoutDayInput, day?: number, year: number = 2025): Promise<TeaWithDay | null> {
  let dayConnection: Prisma.DayCreateNestedOneWithoutTeaInput | undefined = undefined;

  if (day !== undefined) {
    const dayRecord = await prisma.day.findUnique({
      where: { dayNumber_year: { dayNumber: day, year } },
      include: { tea: true }
    });
    if (!dayRecord) throw new Error(`Day ${day}/${year} does not exist`);
    if (dayRecord.tea) throw new Error(`Day ${day}/${year} already has a tea assigned`);
    dayConnection = { connect: { id: dayRecord.id}};
  }

  const tea = await prisma.tea.create({
    data: { ...data, day: dayConnection },
    include: { day: true },
  });
  return tea;
}

export async function addTeaComplete(teaData: Prisma.TeaCreateInput, storyData: Prisma.StoryTeaCreateWithoutTeaInput,  storyImagesData: Array<Prisma.StoryImageCreateWithoutStoryInput>, day: number, year: number = 2025 ): Promise<TeaWithDay | null> {
  const dayResponse = await getDay(day, year);
  if (!dayResponse) return null;
  const tea = await prisma.tea.create({
    data: {
      ...teaData,
      day: { connect: { id: dayResponse.id } },
      story: {
        create: {
          ...storyData,
          images: {
            create: storyImagesData
          }
        }
      },
    },
    include: { day: true },
  });
  return tea;
}

export async function editTea(data: Prisma.TeaUncheckedUpdateInput, id: string, newDayNumber?: number): Promise<TeaWithDay | null>{
  const currentTea = await prisma.tea.findUnique({ where: { id }, select: { dayId: true } });
  if (!currentTea) throw new Error(`No tea found for id ${id}`);
  const result = await prisma.$transaction(async (tx) => {
    if (newDayNumber) {
      const dayRecord = await tx.day.findFirst({ where: { dayNumber: newDayNumber }, include: { tea: true, assignment: true} });
      if (!dayRecord) throw new Error(`Day ${newDayNumber}/2025 not found`);
      if (dayRecord.tea && dayRecord.tea.id !== id) throw new Error(`Day ${newDayNumber}/2025 already has a tea`);
      if (dayRecord.assignment) throw new Error(`Day ${newDayNumber} already has a user assigned`);
      delete data.dayId;
      data.dayId = dayRecord.id;
      
      if (currentTea.dayId) {
        const oldAssignment = await tx.dayAssignment.findUnique({ where: { dayId: currentTea.dayId } });
        if (oldAssignment) {
          await tx.dayAssignment.update({
            where: { id: oldAssignment.id },
            data: { dayId: dayRecord.id }
          });
        }
      }
    }
    const teaUpdated = await tx.tea.update({
      where: { id },
      include: { day: true },
      data: { ...data },
    });
    return teaUpdated;
  });
  return result;
}

export async function editTeaComplete(
  id: string,
  teaData: Prisma.TeaUncheckedUpdateInput,
  storyData: Prisma.StoryTeaCreateWithoutTeaInput,
  storyImagesData: Array<Prisma.StoryImageCreateWithoutStoryInput>,
): Promise<TeaWithDayAndCompleteStory> {
  const tea = await prisma.tea.update({
    where: { id },
    data: {
      ...teaData,
      story: {
        upsert: {
          create: {
            ...storyData,
            images: {
              create: storyImagesData
            }
          },
          update: {
            ...storyData,
            images: {
              deleteMany: {},
              create: storyImagesData
          }
          }
        },
      },
    },
    include: { day: true, story: { include: { images: true } } },
  });
  return tea;
}

export async function deleteTea(id: string): Promise<TeaWithDay> {
  const teaDeleted = await prisma.tea.delete({
    where: { id },
    include: { day: true },
  });
  return teaDeleted;
}
