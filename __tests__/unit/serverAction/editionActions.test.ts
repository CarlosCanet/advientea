import { beforeEach, describe, expect, it, vi } from "vitest";

import { changeEditionStatusAction } from "@/app/actions/editionActions";
import { EditionStatus } from "@/generated/prisma/enums";
import { changeEditionStatus, requireRole } from "@/lib/dal";
import { ConflictError } from "@/lib/errors";

vi.mock("@/lib/dal", () => ({
  changeEditionStatus: vi.fn(),
  createEdition: vi.fn(),
  deleteEdition: vi.fn(),
  requireRole: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("changeEditionStatusAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({} as Awaited<ReturnType<typeof requireRole>>);
  });

  it("changes the status and says what the edition is now", async () => {
    const result = await changeEditionStatusAction(2026, EditionStatus.ACTIVE);

    expect(changeEditionStatus).toHaveBeenCalledWith(2026, EditionStatus.ACTIVE);
    expect(result).toEqual({ message: "La edición 2026 ahora está activa.", success: true });
  });

  it("refuses a status or a year that is not valid before reaching the DAL", async () => {
    const badStatus = await changeEditionStatusAction(2026, "DELETED" as EditionStatus);
    const badYear = await changeEditionStatusAction(2026.5, EditionStatus.ACTIVE);

    expect(badStatus.success).toBe(false);
    expect(badYear.success).toBe(false);
    expect(changeEditionStatus).not.toHaveBeenCalled();
  });

  it("shows the conflict message from the DAL", async () => {
    vi.mocked(changeEditionStatus).mockRejectedValue(new ConflictError("La edición 2025 está activa."));

    const result = await changeEditionStatusAction(2026, EditionStatus.ACTIVE);

    expect(result).toEqual({ message: "La edición 2025 está activa.", success: false });
  });
});
