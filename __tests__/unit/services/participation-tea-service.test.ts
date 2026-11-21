import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EditionStatus, Role } from "@/generated/prisma/enums";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import { getEdition, getParticipationById, saveParticipationTea } from "@/lib/dal";
import { ConflictError, ForbiddenError } from "@/lib/errors";
import { saveTeaForParticipation, type TeaSubmission } from "@/lib/services/participation-tea-service";

vi.mock("@/lib/dal", () => ({ getEdition: vi.fn(), getParticipationById: vi.fn(), saveParticipationTea: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));

type LoadedParticipation = NonNullable<Awaited<ReturnType<typeof getParticipationById>>>;
type LoadedEdition = NonNullable<Awaited<ReturnType<typeof getEdition>>>;

const NO_LONGER_ENROLLED = "Esa inscripción ya no existe.";
const MAY_NOT_EDIT = "No puedes editar este té.";

const ana = { id: "ana-id", role: Role.USER };
const manager = { id: "boss-id", role: Role.EXECUTEAVE };
const admin = { id: "root-id", role: Role.ADMIN };

function participationOf(userId: null | string, year = 2026) {
  return {
    day: null,
    dayId: null,
    guestName: null,
    id: "participation-id",
    tea: null,
    userId,
    year,
  } as unknown as LoadedParticipation;
}

function editionIs(status: EditionStatus, year = 2026) {
  vi.mocked(getEdition).mockResolvedValue({ name: `Advienté ${year}`, status, year } as LoadedEdition);
}

function imageFile(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

/** Each file uploads to a public id named after it, unless told otherwise. */
function uploadsByName(overrides: Record<string, () => Promise<string | undefined>> = {}) {
  vi.mocked(uploadImage).mockImplementation(async (file: File) => {
    const override = overrides[file.name];
    return override ? override() : `advientea-local/2026/teaDay/${file.name}`;
  });
}

const publicIdOf = (name: string) => `advientea-local/2026/teaDay/${name}`;

const content: TeaSubmission["content"] = {
  addMilk: false,
  canReinfuse: true,
  hasTheine: true,
  infusionTime: 4,
  moreIndications: "Sin azúcar",
  name: "Té de la casa",
  reinfuseNumber: 2,
  storeName: "La tetera azul",
  temperature: 85,
  url: "https://www.example.com/te",
};

const story: TeaSubmission["story"] = { onlyMusic: false, storyPart1: "Érase una vez" };

function submission(overrides: Partial<TeaSubmission> = {}): TeaSubmission {
  return { content, keptImages: [], newImages: [], story, ...overrides };
}

/** The first three arguments the DAL was called with: participation, input and options. */
function savedWith() {
  expect(saveParticipationTea).toHaveBeenCalledTimes(1);
  const [participationId, input, options] = vi.mocked(saveParticipationTea).mock.calls[0];
  return { input, options, participationId };
}

async function rejectionOf(call: Promise<unknown>) {
  return call.then(
    () => {
      throw new Error("the call was expected to fail");
    },
    (reason: unknown) => reason,
  );
}

describe("saveTeaForParticipation", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getParticipationById).mockResolvedValue(participationOf("ana-id"));
    editionIs(EditionStatus.PREPARING);
    uploadsByName();
    vi.mocked(deleteAsset).mockResolvedValue({ result: "ok" } as never);
    vi.mocked(saveParticipationTea).mockResolvedValue({ created: true, removedPublicIds: [], teaId: "tea-id" });
  });

  describe("who may save", () => {
    it("loads the participation and the edition of its year", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(participationOf("ana-id", 2027));
      editionIs(EditionStatus.PREPARING, 2027);

      await saveTeaForParticipation(ana, "participation-id", submission());

      expect(getParticipationById).toHaveBeenCalledWith("participation-id");
      expect(getEdition).toHaveBeenCalledWith(2027);
    });

    it("refuses a participation that does not exist as a conflict, uploading and writing nothing", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(null);

      const error = await rejectionOf(
        saveTeaForParticipation(
          ana,
          "participation-id",
          submission({ newImages: [{ file: imageFile("a.png"), order: 0 }] }),
        ),
      );

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(NO_LONGER_ENROLLED);
      expect(uploadImage).not.toHaveBeenCalled();
      expect(saveParticipationTea).not.toHaveBeenCalled();
    });

    it("refuses a participation whose edition does not exist as a conflict, uploading and writing nothing", async () => {
      vi.mocked(getEdition).mockResolvedValue(null);

      const error = await rejectionOf(
        saveTeaForParticipation(
          ana,
          "participation-id",
          submission({ newImages: [{ file: imageFile("a.png"), order: 0 }] }),
        ),
      );

      expect(error).toBeInstanceOf(ConflictError);
      expect((error as Error).message).toBe(NO_LONGER_ENROLLED);
      expect(uploadImage).not.toHaveBeenCalled();
      expect(saveParticipationTea).not.toHaveBeenCalled();
    });

    it("refuses a user the tea of someone else before uploading anything", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(participationOf("sony-id"));

      const error = await rejectionOf(
        saveTeaForParticipation(
          ana,
          "participation-id",
          submission({ newImages: [{ file: imageFile("a.png"), order: 0 }] }),
        ),
      );

      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as Error).message).toBe(MAY_NOT_EDIT);
      expect(uploadImage).not.toHaveBeenCalled();
      expect(saveParticipationTea).not.toHaveBeenCalled();
      expect(deleteAsset).not.toHaveBeenCalled();
    });

    it("refuses a user the tea of a guest", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(participationOf(null));

      const error = await rejectionOf(saveTeaForParticipation(ana, "participation-id", submission()));

      expect(error).toBeInstanceOf(ForbiddenError);
      expect(saveParticipationTea).not.toHaveBeenCalled();
    });

    it("refuses a user and a calendar manager a tea of an archived edition before uploading anything", async () => {
      editionIs(EditionStatus.ARCHIVED);
      const withImage = () => submission({ newImages: [{ file: imageFile("a.png"), order: 0 }] });

      const userError = await rejectionOf(saveTeaForParticipation(ana, "participation-id", withImage()));
      const managerError = await rejectionOf(saveTeaForParticipation(manager, "participation-id", withImage()));

      expect(userError).toBeInstanceOf(ForbiddenError);
      expect(managerError).toBeInstanceOf(ForbiddenError);
      expect((managerError as Error).message).toBe(MAY_NOT_EDIT);
      expect(uploadImage).not.toHaveBeenCalled();
      expect(saveParticipationTea).not.toHaveBeenCalled();
    });

    it("lets a calendar manager save the tea of anyone, a guest included", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(participationOf(null));
      editionIs(EditionStatus.ACTIVE);

      await saveTeaForParticipation(manager, "participation-id", submission());

      expect(saveParticipationTea).toHaveBeenCalledTimes(1);
    });

    it("lets an admin through to the DAL even for an archived edition", async () => {
      editionIs(EditionStatus.ARCHIVED);

      await saveTeaForParticipation(admin, "participation-id", submission());

      expect(saveParticipationTea).toHaveBeenCalledTimes(1);
    });
  });

  describe("what it saves", () => {
    it("saves the content and the story of the submission for that participation", async () => {
      await saveTeaForParticipation(ana, "participation-id", submission());

      const { input, participationId } = savedWith();
      expect(participationId).toBe("participation-id");
      expect(input).toEqual({ content, images: [], story });
    });

    it.each([
      { actor: ana, refusePlayedDay: true, role: "a user" },
      { actor: manager, refusePlayedDay: false, role: "a calendar manager" },
      { actor: admin, refusePlayedDay: false, role: "an admin" },
    ])(
      "asks the DAL to refuse a played day only for a user: $role → $refusePlayedDay",
      async ({ actor, refusePlayedDay }) => {
        vi.mocked(getParticipationById).mockResolvedValue(participationOf(actor.id));

        await saveTeaForParticipation(actor, "participation-id", submission());

        expect(savedWith().options).toEqual({ refusePlayedDay });
      },
    );

    it("answers whether the DAL created the tea", async () => {
      expect(await saveTeaForParticipation(ana, "participation-id", submission())).toEqual({ created: true });

      vi.mocked(saveParticipationTea).mockResolvedValue({ created: false, removedPublicIds: [], teaId: "tea-id" });

      expect(await saveTeaForParticipation(ana, "participation-id", submission())).toEqual({ created: false });
    });

    it("uploads no file when there is no new image", async () => {
      await saveTeaForParticipation(ana, "participation-id", submission({ keptImages: [{ id: "kept", order: 0 }] }));

      expect(uploadImage).not.toHaveBeenCalled();
      expect(savedWith().input.images).toEqual([{ id: "kept", kind: "existing" }]);
    });

    it("uploads every new file to the folder of the edition's year", async () => {
      vi.mocked(getParticipationById).mockResolvedValue(participationOf("ana-id", 2027));
      editionIs(EditionStatus.PREPARING, 2027);
      const first = imageFile("first.png");
      const second = imageFile("second.png");

      await saveTeaForParticipation(
        ana,
        "participation-id",
        submission({
          newImages: [
            { file: first, order: 0 },
            { file: second, order: 1 },
          ],
        }),
      );

      expect(uploadImage).toHaveBeenCalledTimes(2);
      expect(uploadImage).toHaveBeenCalledWith(first, { kind: "teaDay", year: 2027 });
      expect(uploadImage).toHaveBeenCalledWith(second, { kind: "teaDay", year: 2027 });
    });

    it("places kept and new images by their order, whatever order they come in", async () => {
      await saveTeaForParticipation(
        ana,
        "participation-id",
        submission({
          keptImages: [
            { id: "kept-at-two", order: 2 },
            { id: "kept-at-zero", order: 0 },
          ],
          newImages: [
            { file: imageFile("new-at-three.png"), order: 3 },
            { file: imageFile("new-at-one.png"), order: 1 },
          ],
        }),
      );

      expect(savedWith().input.images).toEqual([
        { id: "kept-at-zero", kind: "existing" },
        { kind: "new", publicId: publicIdOf("new-at-one.png") },
        { id: "kept-at-two", kind: "existing" },
        { kind: "new", publicId: publicIdOf("new-at-three.png") },
      ]);
    });

    it("puts a kept image before a new one that claims the same position", async () => {
      await saveTeaForParticipation(
        ana,
        "participation-id",
        submission({
          keptImages: [{ id: "kept", order: 1 }],
          newImages: [{ file: imageFile("new.png"), order: 1 }],
        }),
      );

      expect(savedWith().input.images).toEqual([
        { id: "kept", kind: "existing" },
        { kind: "new", publicId: publicIdOf("new.png") },
      ]);
    });

    it("uploads before it writes", async () => {
      await saveTeaForParticipation(
        ana,
        "participation-id",
        submission({ newImages: [{ file: imageFile("a.png"), order: 0 }] }),
      );

      const uploaded = vi.mocked(uploadImage).mock.invocationCallOrder[0];
      const written = vi.mocked(saveParticipationTea).mock.invocationCallOrder[0];
      expect(uploaded).toBeLessThan(written);
    });
  });

  describe("cleaning up the images", () => {
    const threeNew = () =>
      submission({
        newImages: [
          { file: imageFile("one.png"), order: 0 },
          { file: imageFile("two.png"), order: 1 },
          { file: imageFile("three.png"), order: 2 },
        ],
      });

    it.each([
      { failure: () => Promise.resolve(undefined), what: "returns no public id" },
      { failure: () => Promise.reject(new Error("Cloudinary is down")), what: "throws" },
    ])("deletes the files already uploaded and writes nothing when an upload $what", async ({ failure }) => {
      uploadsByName({ "three.png": failure });

      const error = await rejectionOf(saveTeaForParticipation(ana, "participation-id", threeNew()));

      expect(error).toBeInstanceOf(Error);
      expect(error).not.toBeInstanceOf(ConflictError);
      expect(error).not.toBeInstanceOf(ForbiddenError);
      expect(saveParticipationTea).not.toHaveBeenCalled();
      const deleted = vi.mocked(deleteAsset).mock.calls.map(([publicId]) => publicId);
      expect(deleted.toSorted()).toEqual([publicIdOf("one.png"), publicIdOf("two.png")].toSorted());
    });

    it("still fails with an error of its own when deleting the uploaded files fails too", async () => {
      uploadsByName({ "three.png": () => Promise.resolve(undefined) });
      vi.mocked(deleteAsset).mockRejectedValue(new Error("Cloudinary is down"));

      const error = await rejectionOf(saveTeaForParticipation(ana, "participation-id", threeNew()));

      expect(error).toBeInstanceOf(Error);
      expect(saveParticipationTea).not.toHaveBeenCalled();
    });

    it.each([
      {
        error: new ConflictError(
          "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.",
        ),
        kind: "a conflict",
      },
      { error: new Error("connection lost"), kind: "an unexpected error" },
    ])("deletes the files it uploaded and rethrows the same error when the DAL throws $kind", async ({ error }) => {
      vi.mocked(saveParticipationTea).mockRejectedValue(error);

      const thrown = await rejectionOf(saveTeaForParticipation(ana, "participation-id", threeNew()));

      expect(thrown).toBe(error);
      const deleted = vi.mocked(deleteAsset).mock.calls.map(([publicId]) => publicId);
      expect(deleted.toSorted()).toEqual(
        [publicIdOf("one.png"), publicIdOf("two.png"), publicIdOf("three.png")].toSorted(),
      );
    });

    it("rethrows the error of the DAL even when deleting the uploaded files fails", async () => {
      const error = new ConflictError(NO_LONGER_ENROLLED);
      vi.mocked(saveParticipationTea).mockRejectedValue(error);
      vi.mocked(deleteAsset).mockRejectedValue(new Error("Cloudinary is down"));

      expect(await rejectionOf(saveTeaForParticipation(ana, "participation-id", threeNew()))).toBe(error);
    });

    it("deletes the images the DAL removed once the save succeeded, and none of the new ones", async () => {
      vi.mocked(saveParticipationTea).mockResolvedValue({
        created: false,
        removedPublicIds: ["advientea-local/2026/teaDay/old-one", "advientea-local/2026/teaDay/old-two"],
        teaId: "tea-id",
      });

      await saveTeaForParticipation(ana, "participation-id", threeNew());

      const deleted = vi.mocked(deleteAsset).mock.calls.map(([publicId]) => publicId);
      expect(deleted.toSorted()).toEqual(
        ["advientea-local/2026/teaDay/old-one", "advientea-local/2026/teaDay/old-two"].toSorted(),
      );
    });

    it("deletes nothing when the DAL removed no image", async () => {
      await saveTeaForParticipation(ana, "participation-id", threeNew());

      expect(deleteAsset).not.toHaveBeenCalled();
    });

    it("does not fail the save when deleting a removed image fails", async () => {
      vi.mocked(saveParticipationTea).mockResolvedValue({
        created: false,
        removedPublicIds: ["advientea-local/2026/teaDay/old-one", "advientea-local/2026/teaDay/old-two"],
        teaId: "tea-id",
      });
      vi.mocked(deleteAsset).mockRejectedValueOnce(new Error("Cloudinary is down"));

      expect(await saveTeaForParticipation(ana, "participation-id", submission())).toEqual({ created: false });
      expect(deleteAsset).toHaveBeenCalledTimes(2);
    });
  });
});
