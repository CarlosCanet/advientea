import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Role } from "@/generated/prisma/enums";
import { getAdvienteaDayState } from "@/lib/advientea-rules";

describe("getAdvienteaDayState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // The day after the 2025 name reveal, at noon: far from every hourly gate, so the machine's TZ
    // cannot move the result.
    vi.setSystemTime(new Date(2025, 11, 22, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reveals the participant name to a signed-in user once the reveal day has passed", () => {
    expect(getAdvienteaDayState(3, 2025, Role.USER).isPersonNameReleased).toBe(true);
  });

  it("never reveals the participant name without a role", () => {
    expect(getAdvienteaDayState(3, 2025, undefined).isPersonNameReleased).toBe(false);
  });

  it("keeps the rest of the day state for anonymous visitors", () => {
    const state = getAdvienteaDayState(3, 2025, undefined);

    expect(state).toMatchObject({ isPart1Released: true, isReleased: true, isTeaReleased: true });
  });
});
