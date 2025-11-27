/* eslint-disable @typescript-eslint/no-unused-vars */
import "@/envConfig"
import { prisma } from "@/lib/prisma";
import { add25Days, addDayAssignment, addStoryImage, addStoryTea, addTea, createUser } from "@/lib/dal";
import { Role } from "@/generated/prisma/client";

async function createUsers() {
  // Create admin
  await createUser({
    username: "CarlosC",
    email: "carlos@carlos.com",
    image: "38_kjq3k8",
    password: "Admin123!"
  });
  await prisma.user.update({ where: { email: "carlos@carlos.com" }, data: { role: Role.ADMIN } });
  
  // Create user1
  await createUser({
    username: "Deinos",
    email: "jorgedeinos@gmail.com",
    image: "94_dtpyjy",
    password: "deinos123!"
  })

  // Create user2
  await createUser({
    username: "mikoalilla",
    email: "miko@gmail.com",
    image: "11_n5c86c",
    password: "miko123!"
  })

  // Create user3
  await createUser({
    username: "Ñita",
    email: "ana@gmail.com",
    image: "90_lwzifs",
    password: "anaa123!"
  })

  // Create user4
  await createUser({
    username: "Sony",
    email: "sony@gmail.com",
    image: "100_xh9syq",
    password: "ynos123!"
  })

  // Create user5
  await createUser({
    username: "María",
    email: "maria@gmail.com",
    image: "98_sn7aud",
    password: "maria123!"
  })
}

async function createDays() {
  await add25Days();
}

async function createTeas() {
  await addTea({
    name: "Ruta del desierto",
    infusionTime: 3,
    temperature: 95,
    hasTheine: false,
    canReinfuse: false,
    moreIndications: "Disfrutar a la noche",
    addMilk: false,
    storeName: "La tienda de las especias",
    url: "wwww.tiendadelasespecias.com/rutadeldesierto",
  }, 1, 2025);

  for (let index = 1; index < 25; index++) {
    await addTea({
      name: "Té Chai",
      infusionTime: 6,
      temperature: 105,
      hasTheine: true,
      canReinfuse: true,
      reinfuseNumber: 3,
      moreIndications: "De madrugada sabe mejor",
      addMilk: true,
      storeName: "La tienda de las especias",
      url: "wwww.tiendadelasespecias.com/te-chai"
    }, index + 1, 2025);
  }
}

async function createStoryTeas() {
  await addStoryTea({
    storyPart1: "Todo pasó hace tiempo",
    storyPart2: "Tienes pistas en el nombre",
    storyPart3: "Cuanto más avanzas, más te pierdes",
    youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    onlyMusic: false
  }, 1, 2025);

  await addStoryTea({
    storyPart1: "Jamás",
    storyPart2: "Me",
    storyPart3: "pillarás",
    youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
  }, 2, 2025);

  for (let index = 2; index < 25; index++) {
    await addStoryTea({
      storyPart1: "Story 1",
      storyPart2: "Story 2",
      storyPart3: "Story 3",
    }, index + 1, 2025);
  }
}

async function createStoryImages() {
  await addStoryImage("samples/dessert-on-a-plate", 0, 1, 2025);
  await addStoryImage("samples/coffee", 1, 1, 2025);
  await addStoryImage("samples/cup-on-a-table", 2, 1, 2025);
  
  await addStoryImage("samples/breakfast", 0, 2, 2025);
}

async function createDaysAssignments() {
  await addDayAssignment("jorgedeinos@gmail.com", 1, 2025);
  await addDayAssignment("miko@gmail.com", 2, 2025);
  await addDayAssignment("ana@gmail.com", 3, 2025);
  await addDayAssignment("sony@gmail.com", 4, 2025);
  await addDayAssignment("maria@gmail.com", 5, 2025);
}

async function seed() {
  try {
    // await createUsers();
    // await createDays();
    // await createDaysAssignments();
    // await createTeas();
    // await createStoryTeas();
    // await createStoryImages();
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();