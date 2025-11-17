import bcrypt from "bcryptjs";
import { PrismaClient, Tea } from "../src/generated/prisma/client";

describe("Database seed", () => {
  const prisma = new PrismaClient();

  describe("Tea model", () => {
    it("should create 25 teas", async () => {
      const teas: Tea[] = await prisma.tea.findMany();
      expect(teas).toHaveLength(25);
      expect(Array.isArray(teas)).toBe(true);
    });

    it("should have valid structure", async () => {
      const teaOne = await prisma.tea.findFirst();
      expect(teaOne).toBeDefined();
      expect(teaOne).toHaveProperty("id");
      expect(teaOne).toHaveProperty("dayId");
      expect(teaOne).toHaveProperty("name");
      expect(teaOne).toHaveProperty("infusionTime");
      expect(teaOne).toHaveProperty("temperature");
      expect(teaOne).toHaveProperty("hasTheine");
      expect(teaOne).toHaveProperty("canReinfuse");
      expect(teaOne).toHaveProperty("reinfuseNumber");
      expect(teaOne).toHaveProperty("moreIndications");
      expect(teaOne).toHaveProperty("addMilk");
      expect(teaOne).toHaveProperty("storeName");
      expect(teaOne).toHaveProperty("url");
      expect(teaOne).toHaveProperty("createdAt");
    })

    it("should have correct data types and valid values", async () => {
      const teas: Tea[] = await prisma.tea.findMany();
      expect(teas.length).toBeGreaterThan(0);
      teas.forEach(tea => {
        expect(typeof tea.name).toBe("string");
        expect(tea.name.length).toBeGreaterThan(0);
        if (tea.moreIndications) {
          expect(typeof tea.moreIndications).toBe("string");
          expect(tea.name.length).toBeGreaterThan(0);
        }

        expect(typeof tea.infusionTime).toBe("number");
        expect(tea.infusionTime).toBeGreaterThan(0);
        expect(tea.infusionTime).toBeLessThanOrEqual(15);

        expect(typeof tea.temperature).toBe("number");
        expect(tea.temperature).toBeGreaterThanOrEqual(50);
        expect(tea.temperature).toBeLessThanOrEqual(120);

        expect(typeof tea.hasTheine).toBe("boolean");
        expect(typeof tea.canReinfuse).toBe("boolean");
        expect(typeof tea.addMilk).toBe("boolean");

        if (tea.reinfuseNumber !== null) {
          expect(typeof tea.reinfuseNumber).toBe("number");
          expect(tea.reinfuseNumber).toBeGreaterThan(0);
        }
      })
    })

    it("should have 1-to-1 relation with Day", async () => {
      const teas = await prisma.tea.findMany({ include: { day: true } });
      teas.forEach(tea => {
        expect(tea.day).toBeDefined();
        expect(tea.dayId).toBe(tea.day.id);
      })

      const days = await prisma.day.findMany({ include: { tea: true } });
      days.forEach(day => {
        expect(day.tea).toBeDefined();
        expect(day.tea?.dayId).toBe(day.id);
      })
    })

    it("should have unique dayId", async () => {
      const teas = await prisma.tea.findMany({ include: { day: true } });
      const dayIds = teas.map(tea => tea.dayId);
      const uniqueDayIds = new Set(dayIds);

      expect(uniqueDayIds.size).toBe(teas.length);
    })

    it("should match expected tea for day 1 and 2", async () => {
      const day1 = await prisma.day.findFirst({ where: { dayNumber: 1, year: 2025 }, include: { tea: true } });
      expect(day1).toBeDefined();
      const tea1 = day1!.tea;
      expect(tea1).toBeDefined();
      expect(tea1!.name).toBe("Ruta del desierto");
      expect(tea1!.infusionTime).toBe(3);
      expect(tea1!.temperature).toBe(95);
      expect(tea1!.hasTheine).toBe(false);
      expect(tea1!.canReinfuse).toBe(false);
      expect(tea1!.moreIndications).toBe("Disfrutar a la noche");
      expect(tea1!.addMilk).toBe(false);
      expect(tea1!.storeName).toBe("La tienda de las especias");
      expect(tea1!.url).toBe("wwww.tiendadelasespecias.com/rutadeldesierto");

      const day2 = await prisma.day.findFirst({ where: { dayNumber: 2, year: 2025 }, include: { tea: true } });
      expect(day2).toBeDefined();
      const tea2 = day2!.tea;
      expect(tea2).toBeDefined();
      expect(tea2!.name).toBe("Té Chai");
      expect(tea2!.infusionTime).toBe(6);
      expect(tea2!.temperature).toBe(105);
      expect(tea2!.hasTheine).toBe(true);
      expect(tea2!.canReinfuse).toBe(true);
      expect(tea2!.reinfuseNumber).toBe(3);
      expect(tea2!.moreIndications).toBe("De madrugada sabe mejor");
      expect(tea2!.addMilk).toBe(true);
      expect(tea2!.storeName).toBe("La tienda de las especias");
      expect(tea2!.url).toBe("wwww.tiendadelasespecias.com/te-chai");
    })

    it("should cascade delete when Day is delete", async () => {
      const testDay = await prisma.day.create({ data: { dayNumber: 40, year: 1003 } });
      const testTea = await prisma.tea.create({
        data: {
          dayId: testDay.id,
          name: "Test Tea",
          infusionTime: 3,
          temperature: 80,
          hasTheine: true,
          canReinfuse: false,
          addMilk: false,
          storeName: "Test Store",
          url: "http://test.com",
          moreIndications: "A"
        }
      });

      await prisma.day.delete({ where: { id: testDay.id } });
      const deletedTea = await prisma.tea.findFirst({ where: { id: testTea.id } });
      expect(deletedTea).toBeNull();
    })

  });

  describe("Day model", () => {
    it("should create 25 days", async () => {
      const days = await prisma.day.findMany();
      expect(days).toHaveLength(25);
      expect(Array.isArray(days)).toBe(true);
      expect(days[0]).toBeDefined();
      expect(days[0]).toHaveProperty("dayNumber");
      expect(days[0]).toHaveProperty("year");
      expect(days[0].dayNumber).toBe(1);
      expect(days[0].year).toBe(2025);
    });
  });

  describe("User model", () => {
    it("should create 6 users", async () => {
      const users = await prisma.user.findMany();
      expect(users).toHaveLength(6);
    });
    it("should have 1 admin and match its values", async () => {
      const adminUsers = await prisma.user.findMany({ where: { isAdmin: true }, include: { accounts: true } });
      expect(adminUsers).toHaveLength(1);
      expect(adminUsers[0].username).toBe("CarlosC");
      expect(await bcrypt.compare("admin", adminUsers[0].accounts[0].password!)).toBe(true);
    });
  });

  describe("StoryTea model", () => {
    it("should create 25 storyTeas", async () => {
      const stories = await prisma.storyTea.findMany();
      expect(stories).toHaveLength(25);
      expect(Array.isArray(stories)).toBe(true);
    });

    it("should have valid structure", async () => {
      const storyOne = await prisma.storyTea.findFirst();
      expect(storyOne).toBeDefined();
      expect(storyOne).toHaveProperty("id");
      expect(storyOne).toHaveProperty("dayId");
      expect(storyOne).toHaveProperty("storyPart1");
      expect(storyOne).toHaveProperty("storyPart2");
      expect(storyOne).toHaveProperty("storyPart3");
      expect(storyOne).toHaveProperty("youtubeURL");
      expect(storyOne).toHaveProperty("onlyMusic");
      expect(storyOne).toHaveProperty("createdAt");
      expect(storyOne).toHaveProperty("updatedAt");
    })

    it("should have correct data types and valid values", async () => {
      const stories = await prisma.storyTea.findMany();
      expect(stories.length).toBeGreaterThan(0);
      stories.forEach(story => {
        expect(typeof story.storyPart1).toBe("string");
        expect(story.storyPart1.length).toBeGreaterThan(0);
        expect(typeof story.storyPart2).toBe("string");
        expect(story.storyPart2.length).toBeGreaterThan(0);
        expect(typeof story.storyPart3).toBe("string");
        expect(story.storyPart3.length).toBeGreaterThan(0);

        if (story.youtubeURL) {
          expect(typeof story.youtubeURL).toBe("string");
          expect(story.youtubeURL.length).toBeGreaterThan(0);
        }
        if (story.onlyMusic) {
          expect(typeof story.youtubeURL).toBe("boolean");
        }
      })
    })

    it("should have 1-to-1 relation with Day", async () => {
      const stories = await prisma.storyTea.findMany({ include: { day: true } });
      stories.forEach(story => {
        expect(story.day).toBeDefined();
        expect(story.dayId).toBe(story.day.id);
      })

      const days = await prisma.day.findMany({ include: { story: true } });
      days.forEach(day => {
        expect(day.story).toBeDefined();
        expect(day.story?.dayId).toBe(day.id);
      })
    })

    it("should have unique dayId", async () => {
      const stories = await prisma.storyTea.findMany({ include: { day: true } });
      const dayIds = stories.map(story => story.dayId);
      const uniqueDayIds = new Set(dayIds);

      expect(stories.length).toBeGreaterThan(0);
      expect(uniqueDayIds.size).toBe(stories.length);
    })

    it("should match expected story for day 1, 2 and 3", async () => {
      const day1 = await prisma.day.findFirst({ where: { dayNumber: 1, year: 2025 }, include: { story: true } });
      expect(day1).toBeDefined();
      const story1 = day1!.story;
      expect(story1).toBeDefined();
      expect(story1!.storyPart1).toBe("Todo pasó hace tiempo");
      expect(story1!.storyPart2).toBe("Tienes pistas en el nombre");
      expect(story1!.storyPart3).toBe("Cuanto más avanzas, más te pierdes");
      expect(story1!.youtubeURL).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
      expect(story1!.onlyMusic).toBe(false);

      const day2 = await prisma.day.findFirst({ where: { dayNumber: 2, year: 2025 }, include: { story: true } });
      expect(day2).toBeDefined();
      const story2 = day2!.story;
      expect(story2).toBeDefined();
      expect(story2!.storyPart1).toBe("Jamás");
      expect(story2!.storyPart2).toBe("Me");
      expect(story2!.storyPart3).toBe("pillarás");
      expect(story2!.youtubeURL).toBe("https://www.youtube.com/watch?v=jfKfPfyJRdk");
      expect(story2!.onlyMusic).toBeNull();

      const day3 = await prisma.day.findFirst({ where: { dayNumber: 3, year: 2025 }, include: { story: true } });
      expect(day3).toBeDefined();
      const story3 = day3!.story;
      expect(story3).toBeDefined();
      expect(story3!.storyPart1).toBe("Story 1");
      expect(story3!.storyPart2).toBe("Story 2");
      expect(story3!.storyPart3).toBe("Story 3");
      expect(story3!.youtubeURL).toBeNull()
      expect(story3!.onlyMusic).toBeNull()
    })

    it("should cascade delete when Day is delete", async () => {
      const testDay = await prisma.day.create({ data: { dayNumber: 40, year: 1003 } });
      const testStory = await prisma.storyTea.create({
        data: {
          dayId: testDay.id,
          storyPart1: "a",
          storyPart2: "a",
          storyPart3: "a",
          youtubeURL: "a",
          onlyMusic: false
        }
      });

      await prisma.day.delete({ where: { id: testDay.id } });
      const deletedStoryTea = await prisma.storyTea.findFirst({ where: { id: testStory.id } });
      expect(deletedStoryTea).toBeNull();
    })
  });

  describe("DayAssignment model", () => {
    it("should assign 5 users to the first 5 days", async () => {
      const assignments = await prisma.dayAssignment.findMany();
      expect(assignments).toHaveLength(5);
      expect(Array.isArray(assignments)).toBe(true);
    });

    it("should have 1-to-1 relation with Day", async () => {
      const assignments = await prisma.dayAssignment.findMany({ include: { day: true } });
      expect(assignments.length).toBeGreaterThan(0);
      assignments.forEach((assignment) => {
        expect(assignment.day).toBeTruthy();
        expect(assignment.dayId).toBe(assignment.day.id);
      });

      const days = await prisma.day.findMany({ where: { dayNumber: { lte: 5 } }, include: { assignment: true } });
      days.forEach((day) => {
        expect(day.assignment).toBeDefined();
        expect(day.assignment?.dayId).toBe(day.id);
      });
    });
    
    it("should have 1-to-N relation with User", async () => {
      const assignments = await prisma.dayAssignment.findMany({ include: { user: true } });
      expect(assignments.length).toBeGreaterThan(0);
      assignments.forEach((assignment) => {
        expect(assignment.user).toBeTruthy();
        expect(assignment.userId).toBe(assignment.user.id);
      });

      const users = await prisma.user.findMany({ where: { username: { not: "CarlosC" } }, include: { daysAssigned: true } });
      users.forEach((user) => {
        expect(user.daysAssigned).toBeDefined();
        expect(user.daysAssigned.length).toBeGreaterThan(0);
        user.daysAssigned.forEach(assignment => {
          expect(assignment.userId).toBe(user.id);
        })
      });
    });

    it("should not allow duplicate assignments for the same day and year", async () => {
      const dayAssignment = await prisma.dayAssignment.findFirst();
      expect(dayAssignment).toBeTruthy();

      try {
        await prisma.dayAssignment.create({
          data: {
            year: dayAssignment!.year,
            dayId: dayAssignment!.dayId,
            userId: dayAssignment!.userId
          }
        })
      } catch (error) {
        
      }
      const checkAssignments = await prisma.dayAssignment.findMany({ where: { year: dayAssignment!.year, dayId: dayAssignment!.dayId, userId: dayAssignment!.userId } });
      expect(checkAssignments).toBeTruthy();
      expect(checkAssignments.length).toBe(1);
      
    });

    it("should match the 5 users for the 5 first days", async () => {
      const days = await prisma.day.findMany({ include: { assignment: { include: { day: true, user: true } } } });
      expect(days).toBeDefined();

      expect(days[0].assignment?.day.dayNumber).toBe(1);
      expect(days[0].assignment?.user.username).toBe("Deinos");
      expect(days[1].assignment?.day.dayNumber).toBe(2);
      expect(days[1].assignment?.user.username).toBe("mikoalilla");
      expect(days[2].assignment?.day.dayNumber).toBe(3);
      expect(days[2].assignment?.user.username).toBe("Ñita");
      expect(days[3].assignment?.day.dayNumber).toBe(4);
      expect(days[3].assignment?.user.username).toBe("Sony");
      expect(days[4].assignment?.day.dayNumber).toBe(5);
      expect(days[4].assignment?.user.username).toBe("María");
    });

    it("should cascade delete when Day is delete", async () => {
      const testDay = await prisma.day.create({ data: { dayNumber: 40, year: 1040 } });
      expect(testDay).toBeDefined();
      const testUser = await prisma.user.create({
        data: {
          username: "A",
          email: "a@a.com",
        },
      });
      const testAssignment = await prisma.dayAssignment.create({
        data: {
          year: 2025,
          dayId: testDay.id,
          userId: testUser.id
        }
      });
      
      await prisma.day.delete({ where: { id: testDay.id } });
      const deletedAssignment = await prisma.dayAssignment.findFirst({ where: { id: testAssignment.id } });
      expect(deletedAssignment).toBeNull();
      await prisma.user.delete({ where: { id: testUser.id } });
    });

    it("should cascade delete when User is delete", async () => {
      const testDay = await prisma.day.create({ data: { dayNumber: 40, year: 1040 } });
      expect(testDay).toBeDefined();
      const testUser = await prisma.user.create({
        data: {
          username: "A",
          email: "a@a.com",
        },
      });
      const testAssignment = await prisma.dayAssignment.create({
        data: {
          year: 2025,
          dayId: testDay.id,
          userId: testUser.id
        }
      });
      
      await prisma.user.delete({ where: { id: testUser.id } });
      const deletedAssignment = await prisma.dayAssignment.findFirst({ where: { id: testAssignment.id } });
      expect(deletedAssignment).toBeNull();
      await prisma.day.delete({ where: { id: testDay.id } });
    });
  });

  describe("StoryImage model", () => {
    it("should create 4 images", async () => {
      const images = await prisma.storyImage.findMany();
      expect(images).toHaveLength(4);
      expect(Array.isArray(images)).toBe(true);
    });

    it("should have valid structure", async () => {
      const imageOne = await prisma.storyImage.findFirst();
      expect(imageOne).toBeDefined();
      expect(imageOne).toHaveProperty("id");
      expect(imageOne).toHaveProperty("storyTeaId");
      expect(imageOne).toHaveProperty("url");
      expect(imageOne).toHaveProperty("publicId");
      expect(imageOne).toHaveProperty("order");
      expect(imageOne).toHaveProperty("createdAt");
      expect(imageOne).toHaveProperty("updatedAt");
    });

    it("should have correct data types and valid values", async () => {
      const images = await prisma.storyImage.findMany();
      expect(images.length).toBeGreaterThan(0);
      images.forEach((image) => {
        expect(typeof image.url).toBe("string");
        expect(image.url.length).toBeGreaterThan(0);
        expect(typeof image.publicId).toBe("string");
        expect(image.publicId.length).toBeGreaterThan(0);
        expect(typeof image.order).toBe("number");
        expect(image.order).toBeGreaterThanOrEqual(0);
      });
    });

    it("should have 1-to-many relation with StoryTea", async () => {
      const images = await prisma.storyImage.findMany({ include: { story: true } });
      expect(images.length).toBeGreaterThan(0);
      images.forEach((image) => {
        expect(image.story).toBeTruthy();
        expect(image.storyTeaId).toBe(image.story.id);
      });

      const stories = await prisma.storyTea.findMany({ include: { images: true } });
      stories.forEach((story) => {
        expect(story.images.length).toBeGreaterThanOrEqual(0);
        story.images.forEach(image => {
          expect(image.storyTeaId).toBe(story.id);
        })
      });
    });

    it("should match the 3 images for day 1", async () => {
      const day1 = await prisma.day.findFirst({ where: { dayNumber: 1, year: 2025 }, include: { story: { include: { images: true } } } });
      expect(day1).toBeDefined();
      expect(day1!.story).toBeDefined();
      const images = day1!.story!.images;
      expect(images).toHaveLength(3);
      expect(images[0]).toHaveProperty("url");
      expect(images[0].url).toBe("https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052708/samples/dessert-on-a-plate.jpg");
      expect(images[0]).toHaveProperty("publicId");
      expect(images[0].publicId).toBe("samples/dessert-on-a-plate");
      expect(images[0]).toHaveProperty("order");
      expect(images[0].order).toBe(0);

      expect(images[1]).toHaveProperty("url");
      expect(images[1].url).toBe("https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052707/samples/coffee.jpg");
      expect(images[1]).toHaveProperty("publicId");
      expect(images[1].publicId).toBe("samples/coffee");
      expect(images[1]).toHaveProperty("order");
      expect(images[1].order).toBe(1);

      expect(images[2]).toHaveProperty("url");
      expect(images[2].url).toBe("https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052708/samples/cup-on-a-table.jpg");
      expect(images[2]).toHaveProperty("publicId");
      expect(images[2].publicId).toBe("samples/cup-on-a-table");
      expect(images[2]).toHaveProperty("order");
      expect(images[2].order).toBe(2);
    });

    it("should match the image for day 2", async () => {
      const day2 = await prisma.day.findFirst({ where: { dayNumber: 2, year: 2025 }, include: { story: { include: { images: true } } } });
      expect(day2).toBeDefined();
      expect(day2!.story).toBeDefined();
      const images = day2!.story!.images;
      expect(images).toHaveLength(1);
      expect(images[0]).toHaveProperty("url");
      expect(images[0].url).toBe("https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052704/samples/breakfast.jpg");
      expect(images[0]).toHaveProperty("publicId");
      expect(images[0].publicId).toBe("samples/breakfast");
      expect(images[0]).toHaveProperty("order");
      expect(images[0].order).toBe(0);
    });

    it("should create 0 images for day 3", async () => {
      const day3 = await prisma.day.findFirst({ where: { dayNumber: 3, year: 2025 }, include: { story: { include: { images: true } } } });
      expect(day3).toBeDefined();
      expect(day3!.story).toBeDefined();
      expect(day3!.story!.images.length).toBe(0);
    });

    it("should cascade delete when StoryTea is delete", async () => {
      const testDay = await prisma.day.create({ data: { dayNumber: 40, year: 1040 } });
      expect(testDay).toBeDefined();
      const testStory = await prisma.storyTea.create({
        data: {
          dayId: testDay!.id,
          storyPart1: "a",
          storyPart2: "a",
          storyPart3: "a",
          youtubeURL: "a",
          onlyMusic: false
        },
      });
      const testImage = await prisma.storyImage.create({
        data: {
          storyTeaId: testStory.id,
          url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1719052703/samples/balloons.jpg",
          publicId: "samples/balloons",
          order: 0,
      }})
      
  
      await prisma.storyTea.delete({ where: { id: testStory.id } });
      const deletedImage = await prisma.storyImage.findFirst({ where: { id: testImage.id } });
      expect(deletedImage).toBeNull();
      await prisma.day.delete({ where: { id: testDay.id } });
    });
  });

});
