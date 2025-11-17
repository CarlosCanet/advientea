import 'dotenv/config'
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";
import { Day } from '@/generated/prisma/browser';
import { username } from 'better-auth/plugins';

const prisma = new PrismaClient();

async function createUsers() {
  // Create admin
  const admin = await prisma.user.create({
    data: {
      username: "CarlosC",
      email: "carlos@carlos.com",
      isAdmin: true,
      image: "rve5rqyjkdryycl81m46_f3pno3",
    },
  });
  await prisma.account.create({
    data: {
      id: admin.id,
      accountId: admin.id,
      providerId: "credential",
      userId: admin.id,
      password: await bcrypt.hash("admin", 12),
    }
  })
  
  // Create user1
  const user1 = await prisma.user.create({
    data: {
      username: "Deinos",
      email: "jorgedeinos@gmail.com",
      isAdmin: false,
      image: "lmajfu1dxzdh2pu14sho_mhryym",
    },
  });
  await prisma.account.create({
    data: {
      id: user1.id,
      accountId: user1.id,
      providerId: "credential",
      userId: user1.id,
      password: await bcrypt.hash("deinos", 12),
    }
  })

  // Create user2
  const user2 = await prisma.user.create({
    data: {
      username: "mikoalilla",
      email: "miko@gmail.com",
      isAdmin: false,
      image: "yckwmkloc2wdfqt2fsab_dq3bja",
    },
  });
  await prisma.account.create({
    data: {
      id: user2.id,
      accountId: user2.id,
      providerId: "credential",
      userId: user2.id,
      password: await bcrypt.hash("miko", 12),
    }
  })

  // Create user3
  const user3 = await prisma.user.create({
    data: {
      username: "Ñita",
      email: "ana@gmail.com",
      isAdmin: false,
      image: "rkmsaem9fxnahkuomx7x_beqzba",
    },
  });
  await prisma.account.create({
    data: {
      id: user3.id,
      accountId: user3.id,
      providerId: "credential",
      userId: user3.id,
      password: await bcrypt.hash("ana", 12),
    }
  })

  // Create user4
  const user4 = await prisma.user.create({
    data: {
      username: "Sony",
      email: "sony@gmail.com",
      isAdmin: false,
      image: "mmcqcamq3nqxfajaznar_xczowt",
    },
  });
  await prisma.account.create({
    data: {
      id: user4.id,
      accountId: user4.id,
      providerId: "credential",
      userId: user4.id,
      password: await bcrypt.hash("ynos", 12),
    }
  })


  // Create user5
  const user5 = await prisma.user.create({
    data: {
      username: "María",
      email: "maria@gmail.com",
      isAdmin: false,
      image: "mmcqcamq3nqxfajaznar_xczowt",
    },
  });
  await prisma.account.create({
    data: {
      id: user5.id,
      accountId: user5.id,
      providerId: "credential",
      userId: user5.id,
      password: await bcrypt.hash("maria", 12),
    }
  })

}

async function createDays() {
  for (let index = 0; index < 25; index++) {
    await prisma.day.create({
      data: {
        dayNumber: index + 1,
      },
    });
  }
}

async function createTeas() {
  const days = (await prisma.day.findMany()).sort((day1: Day, day2: Day) => day1.dayNumber - day2.dayNumber);

  await prisma.tea.create({
    data: {
      dayId: days[0].id,
      name: "Ruta del desierto",
      infusionTime: 3,
      temperature: 95,
      hasTheine: false,
      canReinfuse: false,
      moreIndications: "Disfrutar a la noche",
      addMilk: false,
      storeName: "La tienda de las especias",
      url: "wwww.tiendadelasespecias.com/rutadeldesierto",
    }
  });

  for (let index = 1; index < 25; index++) {
    await prisma.tea.create({
      data: {
        dayId: days[index].id,
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
      }
    });
  }
}

async function createStoryTeas() {
  const days = (await prisma.day.findMany()).sort((day1: Day, day2: Day) => day1.dayNumber - day2.dayNumber);

  await prisma.storyTea.create({
    data: {
      dayId: days[0].id,
      storyPart1: "Todo pasó hace tiempo",
      storyPart2: "Tienes pistas en el nombre",
      storyPart3: "Cuanto más avanzas, más te pierdes",
      youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
      onlyMusic: false
    }
  });
  await prisma.storyTea.create({
    data: {
      dayId: days[1].id,
      storyPart1: "Jamás",
      storyPart2: "Me",
      storyPart3: "pillarás",
      youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    }
  });

  for (let index = 2; index < 25; index++) {
    await prisma.storyTea.create({
      data: {
        dayId: days[index].id,
        storyPart1: "Story 1",
        storyPart2: "Story 2",
        storyPart3: "Story 3",
      }
    });
  }
}

async function createStoryImages() {
  const days = (await prisma.day.findMany({ include: { story: true } })).sort((day1: Day, day2: Day) => day1.dayNumber - day2.dayNumber);
  const story1 = days[0].story;
  const story2 = days[1].story;

  if (story1 && story2) {
    await prisma.storyImage.create({
      data: {
        storyTeaId: story1.id,
        url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052708/samples/dessert-on-a-plate.jpg",
        publicId: "samples/dessert-on-a-plate",
        order: 0
      }
    });
    await prisma.storyImage.create({
      data: {
        storyTeaId: story1.id,
        url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052707/samples/coffee.jpg",
        publicId: "samples/coffee",
        order: 1
      }
    });
    await prisma.storyImage.create({
      data: {
        storyTeaId: story1.id,
        url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052708/samples/cup-on-a-table.jpg",
        publicId: "samples/cup-on-a-table",
        order: 2
      }
    });

    await prisma.storyImage.create({
      data: {
        storyTeaId: story2.id,
        url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052704/samples/breakfast.jpg",
        publicId: "samples/breakfast",
        order: 0
      }
    });
  }
}

async function createDaysAssignments() {
  const days = (await prisma.day.findMany({ include: { story: true } })).sort((day1: Day, day2: Day) => day1.dayNumber - day2.dayNumber);
  const deinosUser = await prisma.user.findFirst({ where: { username: "Deinos" } });
  const mikoalillaUser = await prisma.user.findFirst({ where: { username: "mikoalilla" } });
  const nitaUser = await prisma.user.findFirst({ where: { username: "Ñita" } });
  const sonyUser = await prisma.user.findFirst({ where: { username: "Sony" } });
  const mariaUser = await prisma.user.findFirst({ where: { username: "María" } });
  if (deinosUser && mikoalillaUser && nitaUser && sonyUser && mariaUser) {
    const users = [deinosUser, mikoalillaUser, nitaUser, sonyUser, mariaUser];
    for(const [i, user] of users.entries()){
      await prisma.dayAssignment.create({
        data: {
          year: 2025,
          dayId: days[i].id,
          userId: user!.id
      }})
    }
  }
}

async function seed() {
  try {
    // await createUsers();
    // await createDays();
    // await createTeas();
    // await createStoryTeas();
    // await createStoryImages();
    await createDaysAssignments();
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

seed();