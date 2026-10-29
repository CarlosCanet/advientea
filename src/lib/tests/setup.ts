import { beforeEach } from "vitest";

import { seedDatabase } from "../../../prisma/seed-data";
import { resetDatabase } from "./test-utils";

beforeEach(async () => {
  await resetDatabase();
  await seedDatabase({ accounts: false });
});
