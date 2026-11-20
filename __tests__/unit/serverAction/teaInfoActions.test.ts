import { beforeEach, describe, expect, it, vi } from "vitest";

import { editTeaInfoAction } from "@/app/actions/teaInfoActions";
import { Role } from "@/generated/prisma/enums";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import { addStoryTea, editStoryTea, getTeaById, replaceStoryImages, requireSession, updateTeaContent } from "@/lib/dal";
import { UnauthenticatedError } from "@/lib/errors";
import { userCanEditTea } from "@/lib/services/tea-edit-service";

const { DAL_EXPORTS } = vi.hoisted(() => ({
  // Every DAL export the action modules import, as the authorization sweep lists them, plus the guards.
  DAL_EXPORTS: [
    "addDay",
    "addStoryImage",
    "addStoryTea",
    "addTea",
    "assignDay",
    "changeEditionStatus",
    "changeUserRole",
    "createEdition",
    "createTeaGuess",
    "deleteDay",
    "deleteEdition",
    "editStoryTea",
    "editUser",
    "enrolGuest",
    "enrolUser",
    "getActiveEdition",
    "getParticipationByUserId",
    "getTeaById",
    "placeParticipant",
    "replaceStoryImages",
    "requireRole",
    "requireSession",
    "swapParticipants",
    "unenrolParticipant",
    "unplaceParticipant",
    "updateTeaContent",
    "verifySession",
  ] as const,
}));

vi.mock("@/lib/dal", () => {
  const mocks: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const name of DAL_EXPORTS) {
    mocks[name] = vi.fn();
  }
  return mocks;
});
vi.mock("@/lib/services/tea-edit-service", () => ({ userCanEditTea: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

type LoadedTea = NonNullable<Awaited<ReturnType<typeof getTeaById>>>;

const session = {
  isAuth: true as const,
  role: Role.USER,
  user: {
    createdAt: new Date(),
    email: "ana@example.com",
    emailVerified: false,
    id: "ana-id",
    name: "Ana",
    role: Role.USER,
    updatedAt: new Date(),
    username: "Ana",
  },
  userId: "ana-id",
};

// The tea of someone else, as far as the action can tell: whether Ana may edit it is the service's answer.
const loadedTea = {
  id: "tea-id",
  participation: { day: null, id: "participation-id", userId: "sony-id", year: 2026 },
  story: null,
} as unknown as LoadedTea;

/** The form as the edit page sends it, with every text and number field filled in and no image. */
function teaForm(teaId = "tea-id") {
  const form = new FormData();
  form.set("tea_id", teaId);
  form.set("dayNumber", "3");
  form.set("personName", "Ana");
  form.set("teaName", "Té editado");
  form.set("infusionTime", "4");
  form.set("temperature", "85");
  form.set("moreIndications", "Sin azúcar");
  form.set("storeName", "La tienda de las especias");
  form.set("urlStore", "https://www.example.com/te-editado");
  form.set("storyPart1", "Érase una vez");
  form.set("storyPart2", "un té");
  form.set("storyPart3", "que nadie adivinó");
  form.set("youtubeURL", "https://www.youtube.com/watch?v=jfKfPfyJRdk");
  return form;
}

const WRITES = { addStoryTea, deleteAsset, editStoryTea, replaceStoryImages, updateTeaContent, uploadImage };

function expectNoWrites() {
  for (const [name, write] of Object.entries(WRITES)) {
    expect(write, `editTeaInfoAction reached ${name}`).not.toHaveBeenCalled();
  }
}

describe("editTeaInfoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(session);
    vi.mocked(getTeaById).mockResolvedValue(loadedTea);
    vi.mocked(userCanEditTea).mockResolvedValue(true);
    vi.mocked(updateTeaContent).mockResolvedValue({ id: "tea-id" } as never);
    vi.mocked(addStoryTea).mockResolvedValue({ id: "story-id", images: [] } as never);
    vi.mocked(editStoryTea).mockResolvedValue({ id: "story-id", images: [] } as never);
    vi.mocked(replaceStoryImages).mockResolvedValue([] as never);
  });

  it("refuses someone who may not edit the tea and writes nothing", async () => {
    vi.mocked(userCanEditTea).mockResolvedValue(false);

    const result = await editTeaInfoAction(null, teaForm());

    expect(result).toMatchObject({ message: "No puedes editar este té.", success: false });
    // The refusal comes from the answer about this tea, not from a form that never got that far.
    expect(userCanEditTea).toHaveBeenCalledTimes(1);
    expectNoWrites();
  });

  it("uploads nothing for someone who may not edit the tea, even with an image in the form", async () => {
    vi.mocked(userCanEditTea).mockResolvedValue(false);
    const form = teaForm();
    form.append("image_0", new File([new Uint8Array([137, 80, 78, 71])], "tea.png", { type: "image/png" }));
    form.append("images_order", "0");

    const result = await editTeaInfoAction(null, form);

    // The message and the question asked about the tea tell this refusal from a form that failed validation.
    expect(result).toMatchObject({ message: "No puedes editar este té.", success: false });
    expect(userCanEditTea).toHaveBeenCalledTimes(1);
    expect(uploadImage).not.toHaveBeenCalled();
    expectNoWrites();
  });

  it("asks whether the user of the session may edit the tea that was loaded", async () => {
    await editTeaInfoAction(null, teaForm());

    expect(getTeaById).toHaveBeenCalledWith("tea-id");
    expect(userCanEditTea).toHaveBeenCalledTimes(1);
    expect(userCanEditTea).toHaveBeenCalledWith({ id: "ana-id", role: Role.USER }, loadedTea);
  });

  it("asks with the role of the session, whichever it is, and about the tea the form names", async () => {
    const otherTea = { ...loadedTea, id: "other-tea-id" } as LoadedTea;
    vi.mocked(requireSession).mockResolvedValue({
      ...session,
      role: Role.EXECUTEAVE,
      user: { ...session.user, id: "boss-id", role: Role.EXECUTEAVE },
      userId: "boss-id",
    });
    vi.mocked(getTeaById).mockResolvedValue(otherTea);

    await editTeaInfoAction(null, teaForm("other-tea-id"));

    expect(getTeaById).toHaveBeenCalledWith("other-tea-id");
    expect(userCanEditTea).toHaveBeenCalledWith({ id: "boss-id", role: Role.EXECUTEAVE }, otherTea);
  });

  it("updates the tea and says so when the user may edit it", async () => {
    const result = await editTeaInfoAction(null, teaForm());

    expect(result).toMatchObject({ message: "Té actualizado", success: true });
    expect(updateTeaContent).toHaveBeenCalledTimes(1);
    expect(vi.mocked(updateTeaContent).mock.calls[0][0]).toBe("tea-id");
  });

  it("asks whether the user may edit the tea before it writes anything", async () => {
    await editTeaInfoAction(null, teaForm());

    const asked = vi.mocked(userCanEditTea).mock.invocationCallOrder[0];
    const written = Object.values(WRITES).flatMap(
      (write) => (write as unknown as ReturnType<typeof vi.fn>).mock.invocationCallOrder,
    );
    expect(written.length).toBeGreaterThan(0);
    expect(asked).toBeLessThan(Math.min(...written));
  });

  it("answers someone without a session with a failure and never loads the tea", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const result = await editTeaInfoAction(null, teaForm());

    expect(result.success).toBe(false);
    expect(getTeaById).not.toHaveBeenCalled();
    expect(userCanEditTea).not.toHaveBeenCalled();
    expectNoWrites();
  });
});
