import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getDay } from "./dal-day";
import { TeaGetPayload } from "@/generated/prisma/models";

export async function getTea(id: string): Promise<TeaGetPayload<{ include: { day: true, story: { include: { images: true } } } }>>;
export async function getTea(day: number, year?: number): Promise<TeaGetPayload<{ include: { day: true, story: { include: { images: true } } } }>>;

export async function getTea(idOrDay: string | number, year: number = 2025): Promise<TeaGetPayload<{ include: { day: true, story: { include: { images: true } } } }>> {
  try {
    if (typeof idOrDay === "string") {
      const tea = await prisma.tea.findUnique({
        where: { id: idOrDay },
        include: { day: true, story: { include: { images: true } } }
      });
      if (!tea) {
        throw new Error(`Tea with id ${idOrDay} not found`);
      }
      return tea;
    }
    const day = idOrDay;
    const dayResponse = await getDay(day, year);
    if (!dayResponse.tea) {
      throw new Error(`There is no tea for ${day}/${year}`);
    }
    const teaResponse = await prisma.tea.findUnique({
      where: { id: dayResponse.tea.id },
      include: { day: true, story: { include: { images: true } } }
    });
    if (!teaResponse) {
      throw new Error(`There is no tea with id ${dayResponse.tea.id}`);
    }
    return teaResponse;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function getAllTeas(year: number): Promise<Prisma.TeaGetPayload<{ include: { day: true, story: { include: { images: true } }  } }>[]> {
  try {
    const teas = await prisma.tea.findMany({
      where: { day: { year } },
      include: { day: true, story: { include: { images: true } } },
    });
    return teas;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function addTea(data: Prisma.TeaCreateWithoutDayInput, day: number, year: number = 2025): Promise<TeaGetPayload<{ include: { day: true } }>> {
  try {
    const dayResponse = await getDay(day, year);
    const tea = await prisma.tea.create({
      data: { ...data, day: { connect: { id: dayResponse.id } } },
      include: { day: true },
    });
    return tea;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Unique constraint violation creating tea.");
    }
    throw error;
  }
}

export async function addTeaComplete(
  teaData: Prisma.TeaCreateInput,
  storyData: Prisma.StoryTeaCreateInput,
  storyImagesData: Array<Prisma.StoryImageCreateInput>,
  day: number,
  year: number = 2025
): Promise<TeaGetPayload<{ include: { day: true } }>> {
  try {
    const dayResponse = await getDay(day, year);
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
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Unique constraint violation creating tea.");
    }
    throw error;
  }
}

export async function editTea(data: Prisma.TeaUncheckedUpdateInput, id: string): Promise<TeaGetPayload<{ include: { day: true } }>>;
export async function editTea(data: Prisma.TeaUncheckedUpdateInput, day: number, year?: number): Promise<TeaGetPayload<{ include: { day: true } }>>;

export async function editTea(data: Prisma.TeaUncheckedUpdateInput, dayOrId: number | string, year: number = 2025): Promise<TeaGetPayload<{ include: { day: true } }>> {
  try {
    if (typeof dayOrId === "string") {
      const teaUpdated = await prisma.tea.update({
        where: { id: dayOrId },
        include: { day: true },
        data,
      });
      return teaUpdated;
    }

    const dayResponse = await getDay(dayOrId, year);
    if (!dayResponse.tea) {
      throw new Error(`No tea found for day ${dayOrId}/${year}`);
    }
    const teaUpdated = await prisma.tea.update({
      where: { id: dayResponse.tea.id },
      include: { day: true },
      data,
    });
    return teaUpdated;
  } catch (error) {
    console.error(error);
    throw error;
  }
}

export async function editTeaComplete(
  id: string,
  teaData: Omit<Prisma.TeaCreateInput, 'day' | 'story'>,
  storyData: Omit<Prisma.StoryTeaCreateInput, 'tea' | 'images'>,
  storyImagesData: Array<Omit<Prisma.StoryImageCreateInput, 'story'>>,
): Promise<TeaGetPayload<{ include: {  day: true, story: { include: { images: true } } } }>> {
  try {
    const tea = await prisma.tea.update({
      where: { id },
      data: {
        ...teaData,
        story: {
          update: {
            ...storyData,
            images: {
              deleteMany: {},
              create: storyImagesData
            }
          },
        },
      },
      include: { day: true, story: { include: { images: true } } },
    });
    return tea;
  } catch (error) {
    console.error(error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      console.error("Unique constraint violation creating tea.");
    }
    throw error;
  }
}

export async function deleteTea(id: string): Promise<TeaGetPayload<{ include: { day: true } }>>;
export async function deleteTea(day: number, year?: number): Promise<TeaGetPayload<{ include: { day: true } }>>;

export async function deleteTea(dayOrId: number | string, year: number = 2025): Promise<TeaGetPayload<{ include: { day: true } }>> {
  try {
    if (typeof dayOrId === "string") {
      const teaDeleted = await prisma.tea.delete({
        where: { id: dayOrId },
        include: { day: true },
      });
      return teaDeleted;
    }
    const dayResponse = await getDay(dayOrId, year);
    if (!dayResponse.tea) {
      throw new Error(`No tea found for day ${dayOrId}/${year}`);
    }
    const result = await prisma.tea.delete({
      where: { id: dayResponse.tea.id },
      include: { day: true },
    });
    return result;
  } catch (error) {
    console.error(error);
    throw error;
  }
}
