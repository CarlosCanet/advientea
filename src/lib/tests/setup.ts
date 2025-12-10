import { beforeEach } from "vitest";
import { resetDatabase, seedDatabase } from "./test-utils";

beforeEach(async () => {
  await resetDatabase();
  await seedDatabase();
})