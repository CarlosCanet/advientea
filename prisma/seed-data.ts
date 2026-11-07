import { EditionStatus, Role, TeaType } from "@/generated/prisma/enums";
import {
  add25Days,
  addStoryTea,
  addTea,
  assignDay,
  AssigneeInput,
  createPrismaUser,
  getDayByDayNumber,
  replaceStoryImages,
  upsertEdition,
} from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { createUser } from "@/lib/services/user-service";

// Development databases only. Every seeded account shares this password.
export const SEED_PASSWORD = "Advientea2026!";

type SeedUser = { email: string; image: string; role: Role; username: string };

const USERS = {
  admin: { email: "admin@example.com", image: "38_kjq3k8", role: Role.ADMIN, username: "CarlosC" },
  ana: { email: "ana@example.com", image: "90_lwzifs", role: Role.USER, username: "Ñita" },
  manager: { email: "gerente@example.com", image: "94_dtpyjy", role: Role.EXECUTEAVE, username: "Deinos" },
  miko: { email: "miko@example.com", image: "11_n5c86c", role: Role.USER, username: "mikoalilla" },
  sony: { email: "sony@example.com", image: "100_xh9syq", role: Role.USER, username: "Sony" },
} satisfies Record<string, SeedUser>;

const INGREDIENTS = ["Manzana", "Limón", "Clavo", "Canela", "Cardamomo"] as const;

type SeedOptions = {
  // With accounts the users go through better-auth and can sign in, at one scrypt hash each
  // (~0.3 s). The integration suite reseeds before every test and never signs in, so it skips them.
  accounts?: boolean;
  year?: number;
};

export async function seedDatabase({ accounts = true, year = 2025 }: SeedOptions = {}) {
  // The catalogue comes from the data migration. Checked before the first write because the seed
  // is not idempotent: a half-seeded database cannot be seeded again.
  const found = await prisma.teaIngredient.findMany({ where: { name: { in: [...INGREDIENTS] } } });
  const byName = new Map(found.map((ingredient) => [ingredient.name, ingredient]));
  const missing = INGREDIENTS.filter((name) => !byName.has(name));
  if (missing.length > 0) {
    throw new Error(`Ingredients missing (${missing.join(", ")}): apply the migrations before seeding.`);
  }
  const [apple, lemon, clove, cinnamon, cardamom] = INGREDIENTS.map((name) => byName.get(name)!);

  const createSeedUser = (user: SeedUser) =>
    accounts ? createUser({ ...user, password: SEED_PASSWORD }) : createPrismaUser(user);
  await createSeedUser(USERS.admin);
  const manager = await createSeedUser(USERS.manager);
  const miko = await createSeedUser(USERS.miko);
  const ana = await createSeedUser(USERS.ana);
  const sony = await createSeedUser(USERS.sony);

  // Active: the seeded year is the one dev and the tests play with, and nothing else creates editions.
  await upsertEdition(year, EditionStatus.ACTIVE);
  await add25Days(year);

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
    {
      dayNumber: 1,
      year,
    },
  );
  if (!tea1) throw new Error("Tea for day 1 was not created");
  const story1 = await addStoryTea(
    {
      onlyMusic: false,
      storyPart1: "Todo pasó hace tiempo",
      storyPart2: "Tienes pistas en el nombre",
      storyPart3: "Cuanto más avanzas, más te pierdes",
      youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    },
    tea1.id,
  );
  await replaceStoryImages(story1.id, [
    { kind: "new", publicId: "samples/dessert-on-a-plate" },
    { kind: "new", publicId: "samples/coffee" },
    { kind: "new", publicId: "samples/cup-on-a-table" },
  ]);

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
    [clove.id, cinnamon.id, cardamom.id],
    {
      dayNumber: 2,
      year,
    },
  );
  if (!tea2) throw new Error("Tea for day 2 was not created");
  const story2 = await addStoryTea(
    {
      storyPart1: "Jamás",
      storyPart2: "Me",
      storyPart3: "pillarás",
      youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    },
    tea2.id,
  );
  await replaceStoryImages(story2.id, [{ kind: "new", publicId: "samples/breakfast" }]);

  // Assigning is only allowed on days that have not opened, so the seed clock sits before the edition.
  const seedNow = new Date(`${year}-11-01T12:00:00+01:00`);
  const assign = async (dayNumber: number, assignee: AssigneeInput) => {
    const seededDay = await getDayByDayNumber({ dayNumber, year });
    if (!seededDay) {
      throw new Error(`Day ${dayNumber}/${year} was not created`);
    }
    await assignDay(seededDay.id, assignee, seedNow);
  };
  await assign(1, { userId: manager.id });
  await assign(2, { guestName: "Anónimo" });
  await assign(3, { userId: ana.id });
  await assign(4, { userId: sony.id });
  await assign(5, { userId: miko.id });
}
