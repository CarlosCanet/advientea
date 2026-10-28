import { Role, TeaType } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

import { add25Days, addDayAssignment, addStoryImage, addStoryTea, addTea, createTeaGuess } from "../dal";
import { createPrismaUser } from "../dal/dal-user";

export async function seedDatabase() {
  // **** CREATE USERS **** //
  await createPrismaUser({ email: "carlos@carlos.com", image: "38_kjq3k8", username: "CarlosC" });
  await prisma.user.update({ data: { role: Role.ADMIN }, where: { email: "carlos@carlos.com" } });

  const deinosUser = await createPrismaUser({ email: "jorgedeinos@gmail.com", image: "94_dtpyjy", username: "Deinos" });
  await prisma.user.update({ data: { role: Role.EXECUTEAVE }, where: { email: "jorgedeinos@gmail.com" } });

  const mikoUser = await createPrismaUser({ email: "miko@gmail.com", image: "11_n5c86c", username: "mikoalilla" });
  const anaUser = await createPrismaUser({ email: "ana@gmail.com", image: "90_lwzifs", username: "Ñita" });
  const sonyUser = await createPrismaUser({ email: "sony@gmail.com", image: "100_xh9syq", username: "Sony" });

  // **** CREATE DAYS **** //
  await add25Days();

  // **** INGREDIENTS **** //
  // The catalogue comes from the data migration applied by the global setup, which is why
  // resetDatabase() leaves teaIngredient alone: deleting it would break these lookups.
  const apple = await prisma.teaIngredient.findUnique({ where: { name: "Manzana" } });
  const lemon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Limón" } });
  const clove = await prisma.teaIngredient.findUnique({ where: { name: "Clavo" } });
  const cinnamon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Canela" } });
  const cardamon = await prisma.teaIngredient.findUniqueOrThrow({ where: { name: "Cardamomo" } });
  if (!apple || !lemon || !clove || !cinnamon || !cardamon) throw new Error("There was a problem adding ingredients");

  // **** CREATE TEAS, STORIES & IMAGES **** //
  const tea1 = await addTea(
    {
      addMilk: false,
      canReinfuse: false,
      hasTheine: false,
      infusionTime: 3,
      moreIndications: "Disfrutar a la noche",
      name: "Ruta del desierto",
      storeName: "La tienda de las especias",
      teaType: TeaType.ROOIBOS,
      temperature: 95,
      url: "https://www.tiendadelasespecias.com/rutadeldesierto",
    },
    [apple.id, lemon.id],
    1,
    2025,
  );
  if (tea1) {
    const storyOne = await addStoryTea(
      {
        onlyMusic: false,
        storyPart1: "Todo pasó hace tiempo",
        storyPart2: "Tienes pistas en el nombre",
        storyPart3: "Cuanto más avanzas, más te pierdes",
        youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      },
      tea1.id,
    );
    await addStoryImage("samples/dessert-on-a-plate", 0, storyOne.id);
    await addStoryImage("samples/coffee", 1, storyOne.id);
    await addStoryImage("samples/cup-on-a-table", 2, storyOne.id);
  }

  const tea2 = await addTea(
    {
      addMilk: true,
      canReinfuse: true,
      hasTheine: true,
      infusionTime: 5,
      moreIndications: "En pakistán sabe mejor",
      name: "Pakistaní",
      reinfuseNumber: 2,
      storeName: "La tienda de las especias",
      teaType: TeaType.BLACK,
      temperature: 105,
      url: "https://www.tiendadelasespecias.com/rutadeldesierto",
    },
    [clove.id, cinnamon.id, cardamon.id],
    2,
    2025,
  );
  if (tea2) {
    const storyTwo = await addStoryTea(
      {
        storyPart1: "Jamás",
        storyPart2: "Me",
        storyPart3: "pillarás",
        youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      },
      tea2.id,
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
  //       url: "https://www.tiendadelasespecias.com/te-chai",
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
    prisma.teaGuess.deleteMany(),
    prisma.dayAssignment.deleteMany(),
    prisma.tea.deleteMany(),
    // prisma.teaIngredient.deleteMany(),
    prisma.day.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
