import { prisma } from "@/lib/prisma";
import { createPrismaUser } from "../dal/dal-user";
import { Role } from "@/generated/prisma/enums";
import { add25Days, addDayAssignment, addStoryImage, addStoryTea, addTea } from "../dal";

export async function seedDatabase() {
  // **** CREATE USERS **** //
  await createPrismaUser({ username: "CarlosC", email: "carlos@carlos.com", image: "38_kjq3k8" });
  await prisma.user.update({ where: { email: "carlos@carlos.com" }, data: { role: Role.ADMIN } });

  const deinosUser = await createPrismaUser({ username: "Deinos", email: "jorgedeinos@gmail.com", image: "94_dtpyjy" });
  await prisma.user.update({ where: { email: "jorgedeinos@gmail.com" }, data: { role: Role.EXECUTEAVE } });

  const mikoUser = await createPrismaUser({ username: "mikoalilla", email: "miko@gmail.com", image: "11_n5c86c" });
  const anaUser = await createPrismaUser({ username: "Ñita", email: "ana@gmail.com", image: "90_lwzifs" });
  const sonyUser = await createPrismaUser({ username: "Sony", email: "sony@gmail.com", image: "100_xh9syq" });

  // **** CREATE DAYS **** //
  await add25Days();

  // **** CREATE TEAS, STORIES & IMAGES **** //
  const tea1 = await addTea(
    {
      name: "Ruta del desierto",
      infusionTime: 3,
      temperature: 95,
      hasTheine: false,
      canReinfuse: false,
      moreIndications: "Disfrutar a la noche",
      addMilk: false,
      storeName: "La tienda de las especias",
      url: "wwww.tiendadelasespecias.com/rutadeldesierto",
    },
    1,
    2025
  );
  if (tea1) {
    const storyOne = await addStoryTea(
      {
        storyPart1: "Todo pasó hace tiempo",
        storyPart2: "Tienes pistas en el nombre",
        storyPart3: "Cuanto más avanzas, más te pierdes",
        youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
        onlyMusic: false,
      },
      tea1.id
    );
    await addStoryImage("samples/dessert-on-a-plate", 0, storyOne.id);
    await addStoryImage("samples/coffee", 1, storyOne.id);
    await addStoryImage("samples/cup-on-a-table", 2, storyOne.id);
  }

  const tea2 = await addTea(
    {
      name: "Pakistaní",
      infusionTime: 5,
      temperature: 105,
      hasTheine: true,
      canReinfuse: true,
      reinfuseNumber: 2,
      moreIndications: "En pakistán sabe mejor",
      addMilk: true,
      storeName: "La tienda de las especias",
      url: "wwww.tiendadelasespecias.com/rutadeldesierto",
    },
    2,
    2025
  );
  if (tea2) {
    const storyTwo = await addStoryTea(
      {
        storyPart1: "Jamás",
        storyPart2: "Me",
        storyPart3: "pillarás",
        youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      },
      tea2.id
    );
    await addStoryImage("samples/breakfast", 0, storyTwo.id);
  }

  // Create teas until 25
  // for (let index = 2; index < 25; index++) {
  //   const tea = await addTea(
  //     {
  //       name: `Té random ${index + 1}`,
  //       infusionTime: 6,
  //       temperature: 105,
  //       hasTheine: true,
  //       canReinfuse: true,
  //       reinfuseNumber: 3,
  //       moreIndications: "De madrugada sabe mejor",
  //       addMilk: true,
  //       storeName: "La tienda de las especias",
  //       url: "wwww.tiendadelasespecias.com/te-chai",
  //     },
  //     index + 1,
  //     2025
  //   );
  //   if (tea) {
  //     await addStoryTea(
  //       {
  //         storyPart1: `Story 1 del día ${index + 1}`,
  //         storyPart2: `Story 2 del día ${index + 1}`,
  //         storyPart3: `Story 3 del día ${index + 1}`,
  //       },
  //       tea.id
  //     );
  //   }
  // }

  // **** CREATE DAY ASSIGNMENTS **** //
  await addDayAssignment({ userId: deinosUser.id }, 1, 2025);
  await addDayAssignment({ guestName: "Anónimo" }, 2, 2025);
  await addDayAssignment({ userId: anaUser.id }, 3, 2025);
  await addDayAssignment({ userId: sonyUser.id }, 4, 2025);
  await addDayAssignment({ userId: mikoUser.id }, 5, 2025);
}

export async function resetDatabase() {
  await prisma.$transaction([
    prisma.storyImage.deleteMany(),
    prisma.storyTea.deleteMany(),
    prisma.tea.deleteMany(),
    prisma.day.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
