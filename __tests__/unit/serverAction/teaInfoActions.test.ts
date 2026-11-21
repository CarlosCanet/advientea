import { revalidatePath } from "next/cache";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { editTeaInfoAction, saveGuestTeaAction, saveMyTeaAction } from "@/app/actions/teaInfoActions";
import { EditionStatus, Role } from "@/generated/prisma/enums";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import { getGuestParticipationByToken, getOpenParticipationByUserId, getTeaById, requireSession } from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { saveTeaForParticipation } from "@/lib/services/participation-tea-service";

const { cookieJar, DAL_EXPORTS } = vi.hoisted(() => ({
  // The cookies of the request, by name.
  cookieJar: new Map<string, string>(),
  // Every DAL export the action modules import, as the authorization sweep lists them, plus the guards.
  DAL_EXPORTS: [
    "addStoryTea",
    "addTea",
    "changeEditionStatus",
    "changeUserRole",
    "createEdition",
    "createTeaGuess",
    "deleteDay",
    "deleteEdition",
    "editUser",
    "enrolGuest",
    "enrolUser",
    "getActiveEdition",
    "getGuestParticipationByToken",
    "getOpenParticipationByUserId",
    "getParticipationByUserId",
    "getTeaById",
    "placeParticipant",
    "regenerateGuestToken",
    "replaceStoryImages",
    "requireRole",
    "requireSession",
    "swapParticipants",
    "unenrolParticipant",
    "unplaceParticipant",
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
vi.mock("@/lib/services/participation-tea-service", () => ({ saveTeaForParticipation: vi.fn() }));
vi.mock("@/lib/services/tea-edit-service", () => ({ userCanEditTea: vi.fn() }));
vi.mock("@/lib/cloudinary", () => ({ deleteAsset: vi.fn(), uploadImage: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn().mockResolvedValue(null) } } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
    getAll: () => [...cookieJar].map(([name, value]) => ({ name, value })),
    has: (name: string) => cookieJar.has(name),
  })),
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

type LoadedTea = NonNullable<Awaited<ReturnType<typeof getTeaById>>>;
type OpenParticipation = NonNullable<Awaited<ReturnType<typeof getOpenParticipationByUserId>>>;
type GuestParticipation = NonNullable<Awaited<ReturnType<typeof getGuestParticipationByToken>>>;

const INVALID_FORM = "Hay errores en el formulario";
const NOT_SIGNED_IN = new UnauthenticatedError().message;

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

const managerSession = {
  ...session,
  role: Role.EXECUTEAVE,
  user: { ...session.user, id: "boss-id", role: Role.EXECUTEAVE },
  userId: "boss-id",
};

// The tea of someone else, as far as the action can tell: whether the session may save it is the service's answer.
const loadedTea = {
  id: "tea-id",
  participation: { day: { dayNumber: 3 }, id: "participation-id", userId: "sony-id", year: 2026 },
  story: null,
} as unknown as LoadedTea;

const openParticipation = {
  day: null,
  edition: { name: "Advienté 2026", status: EditionStatus.PREPARING, year: 2026 },
  id: "open-participation-id",
  tea: null,
  userId: "ana-id",
  year: 2026,
} as unknown as OpenParticipation;

const GUEST_COOKIE = "advientea-guest";
const INVALID_LINK = "Este enlace no es válido o ha caducado. Pide uno nuevo al GerenTé.";

const guestParticipation = {
  day: { dayNumber: 7, id: "day-id" },
  edition: { name: "Advienté 2026", status: EditionStatus.ACTIVE, year: 2026 },
  guestName: "Prima Lejana",
  id: "guest-participation-id",
  tea: null,
  userId: null,
  year: 2026,
} as unknown as GuestParticipation;

/** The tea form as the page sends it, with every text and number field filled in and no image. */
function teaForm() {
  const form = new FormData();
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

function editForm(teaId = "tea-id") {
  const form = teaForm();
  form.set("tea_id", teaId);
  return form;
}

/** A form the shared rules reject: no tea name and a temperature that is not a number. */
function invalid(form: FormData) {
  form.set("teaName", "");
  form.set("temperature", "caliente");
  return form;
}

function png(name: string) {
  return new File([new Uint8Array([137, 80, 78, 71])], name, { type: "image/png" });
}

/** The arguments the service was called with. */
function serviceCall() {
  expect(saveTeaForParticipation).toHaveBeenCalledTimes(1);
  const [actor, participationId, submission] = vi.mocked(saveTeaForParticipation).mock.calls[0];
  return { actor, participationId, submission };
}

const WRITES = { deleteAsset, saveTeaForParticipation, uploadImage };

function expectNoWrites(actionName: string) {
  for (const [name, write] of Object.entries(WRITES)) {
    expect(write, `${actionName} reached ${name}`).not.toHaveBeenCalled();
  }
}

beforeAll(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("editTeaInfoAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(session);
    vi.mocked(getTeaById).mockResolvedValue(loadedTea);
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: false });
  });

  it("answers someone without a session with the message of the guard and never loads the tea", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const result = await editTeaInfoAction(null, editForm());

    expect(result).toMatchObject({ message: NOT_SIGNED_IN, success: false });
    expect(getTeaById).not.toHaveBeenCalled();
    expectNoWrites("editTeaInfoAction");
  });

  it("says the tea no longer exists when the form names none", async () => {
    const result = await editTeaInfoAction(null, teaForm());

    expect(result).toMatchObject({ message: "Ese té ya no existe.", success: false });
    expectNoWrites("editTeaInfoAction");
  });

  it("says the tea no longer exists when the tea it names is not there", async () => {
    vi.mocked(getTeaById).mockResolvedValue(null);

    const result = await editTeaInfoAction(null, editForm("gone-tea-id"));

    expect(getTeaById).toHaveBeenCalledWith("gone-tea-id");
    expect(result).toMatchObject({ message: "Ese té ya no existe.", success: false });
    expectNoWrites("editTeaInfoAction");
  });

  it("saves through the service for the user of the session and the participation of the tea", async () => {
    await editTeaInfoAction(null, editForm());

    expect(getTeaById).toHaveBeenCalledWith("tea-id");
    const { actor, participationId } = serviceCall();
    expect(actor).toEqual({ id: "ana-id", kind: "user", role: Role.USER });
    expect(participationId).toBe("participation-id");
  });

  it("saves with the role of the session, whichever it is", async () => {
    vi.mocked(requireSession).mockResolvedValue(managerSession);

    await editTeaInfoAction(null, editForm());

    expect(serviceCall().actor).toEqual({ id: "boss-id", kind: "user", role: Role.EXECUTEAVE });
  });

  it("hands the service the tea, the story and the images of the form", async () => {
    const form = editForm();
    form.append("kept_images", "kept-one");
    form.append("kept_images_order", "2");
    form.append("kept_images", "kept-two");
    form.append("kept_images_order", "0");
    form.append("image_0", png("new.png"));
    form.append("images_order", "1");

    await editTeaInfoAction(null, form);

    const { submission } = serviceCall();
    expect(submission.content).toMatchObject({
      infusionTime: 4,
      moreIndications: "Sin azúcar",
      name: "Té editado",
      storeName: "La tienda de las especias",
      temperature: 85,
      url: "https://www.example.com/te-editado",
    });
    expect(submission.story).toMatchObject({
      storyPart1: "Érase una vez",
      storyPart2: "un té",
      storyPart3: "que nadie adivinó",
      youtubeURL: "https://www.youtube.com/watch?v=jfKfPfyJRdk",
    });
    expect(submission.keptImages.toSorted((a, b) => a.order - b.order)).toEqual([
      { id: "kept-two", order: 0 },
      { id: "kept-one", order: 2 },
    ]);
    expect(submission.newImages).toHaveLength(1);
    expect(submission.newImages[0].order).toBe(1);
    expect(submission.newImages[0].file.name).toBe("new.png");
  });

  it("needs neither a person name nor a day number", async () => {
    const form = editForm();
    expect(form.has("personName")).toBe(false);
    expect(form.has("dayNumber")).toBe(false);

    const result = await editTeaInfoAction(null, form);

    expect(result.success).toBe(true);
    expect(saveTeaForParticipation).toHaveBeenCalledTimes(1);
  });

  it("answers an invalid form with its errors and what was typed, and never calls the service", async () => {
    const result = await editTeaInfoAction(null, invalid(editForm()));

    expect(result).toMatchObject({ message: INVALID_FORM, success: false });
    expect(result.errors).toBeDefined();
    expect(result.inputs).toBeDefined();
    expectNoWrites("editTeaInfoAction");
  });

  it("says the tea was updated and refreshes the pages that show it", async () => {
    const result = await editTeaInfoAction(null, editForm());

    expect(result).toMatchObject({ message: "Té actualizado.", success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/my-tea");
    expect(revalidatePath).toHaveBeenCalledWith("/editions/2026");
  });

  it("says the tea was saved if the service created it", async () => {
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: true });

    const result = await editTeaInfoAction(null, editForm());

    expect(result).toMatchObject({ message: "Té guardado.", success: true });
  });

  it.each([
    { error: new ForbiddenError("No puedes editar este té."), kind: "a refusal" },
    {
      error: new ConflictError(
        "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.",
      ),
      kind: "a conflict",
    },
    { error: new UnauthenticatedError(), kind: "a lost session" },
  ])("passes $kind of the service on as it is", async ({ error }) => {
    vi.mocked(saveTeaForParticipation).mockRejectedValue(error);

    const result = await editTeaInfoAction(null, editForm());

    expect(result).toMatchObject({ message: error.message, success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers an unexpected failure with a generic message", async () => {
    vi.mocked(saveTeaForParticipation).mockRejectedValue(new Error("connection lost to db.internal:5432"));

    const result = await editTeaInfoAction(null, editForm());

    expect(result).toMatchObject({ message: "No se pudo actualizar el té. Inténtalo de nuevo.", success: false });
  });
});

describe("saveMyTeaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireSession).mockResolvedValue(session);
    vi.mocked(getOpenParticipationByUserId).mockResolvedValue(openParticipation);
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: true });
  });

  it("answers someone without a session with the message of the guard and looks nothing up", async () => {
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());

    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: NOT_SIGNED_IN, success: false });
    expect(getOpenParticipationByUserId).not.toHaveBeenCalled();
    expectNoWrites("saveMyTeaAction");
  });

  it("refuses someone who is enrolled in no open edition", async () => {
    vi.mocked(getOpenParticipationByUserId).mockResolvedValue(null);

    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "No estás inscrito en ninguna edición abierta.", success: false });
    expectNoWrites("saveMyTeaAction");
  });

  it("saves through the service for the user of the session and their open participation", async () => {
    await saveMyTeaAction(null, teaForm());

    expect(getOpenParticipationByUserId).toHaveBeenCalledWith("ana-id");
    const { actor, participationId } = serviceCall();
    expect(actor).toEqual({ id: "ana-id", kind: "user", role: Role.USER });
    expect(participationId).toBe("open-participation-id");
  });

  it("saves with the role of the session, whichever it is", async () => {
    vi.mocked(requireSession).mockResolvedValue(managerSession);

    await saveMyTeaAction(null, teaForm());

    expect(getOpenParticipationByUserId).toHaveBeenCalledWith("boss-id");
    expect(serviceCall().actor).toEqual({ id: "boss-id", kind: "user", role: Role.EXECUTEAVE });
  });

  it("takes the participation from the session, never from the form", async () => {
    const form = teaForm();
    form.set("participationId", "someone-elses-participation");
    form.set("participation_id", "someone-elses-participation");
    form.set("tea_id", "someone-elses-tea");

    await saveMyTeaAction(null, form);

    expect(serviceCall().participationId).toBe("open-participation-id");
    expect(getTeaById).not.toHaveBeenCalled();
  });

  it("hands the service the tea and the story of the form", async () => {
    await saveMyTeaAction(null, teaForm());

    const { submission } = serviceCall();
    expect(submission.content).toMatchObject({ infusionTime: 4, name: "Té editado", temperature: 85 });
    expect(submission.story).toMatchObject({ storyPart1: "Érase una vez" });
    expect(submission.keptImages).toEqual([]);
    expect(submission.newImages).toEqual([]);
  });

  it("answers an invalid form with its errors and what was typed, and never calls the service", async () => {
    const result = await saveMyTeaAction(null, invalid(teaForm()));

    expect(result).toMatchObject({ message: INVALID_FORM, success: false });
    expect(result.errors).toBeDefined();
    expect(result.inputs).toBeDefined();
    expectNoWrites("saveMyTeaAction");
  });

  it("says the tea was saved when it was created, and refreshes the page", async () => {
    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "Té guardado.", success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/my-tea");
  });

  it("says the tea was updated when it already existed", async () => {
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: false });

    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "Té actualizado.", success: true });
  });

  it.each([
    {
      error: new ConflictError(
        "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.",
      ),
      kind: "a conflict",
    },
    { error: new ConflictError("Esa inscripción ya no existe."), kind: "a participation that is gone" },
    { error: new ForbiddenError("No puedes editar este té."), kind: "a refusal" },
  ])("passes $kind of the service on as it is", async ({ error }) => {
    vi.mocked(saveTeaForParticipation).mockRejectedValue(error);

    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: error.message, success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers an unexpected failure with a generic message", async () => {
    vi.mocked(saveTeaForParticipation).mockRejectedValue(new Error("connection lost to db.internal:5432"));

    const result = await saveMyTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "No se pudo guardar el té. Inténtalo de nuevo.", success: false });
  });
});

describe("saveGuestTeaAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieJar.clear();
    cookieJar.set(GUEST_COOKIE, "cookie-token");
    // A guest has no account: asking for a session would turn them away.
    vi.mocked(requireSession).mockRejectedValue(new UnauthenticatedError());
    vi.mocked(getGuestParticipationByToken).mockResolvedValue(guestParticipation);
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: true });
  });

  it("refuses a visitor without the cookie, whatever token the form carries", async () => {
    cookieJar.clear();
    const form = teaForm();
    form.set("token", "form-token");
    form.set("guestToken", "form-token");

    const result = await saveGuestTeaAction(null, form);

    expect(result).toMatchObject({ message: INVALID_LINK, success: false });
    expect(getGuestParticipationByToken).not.toHaveBeenCalledWith("form-token");
    expectNoWrites("saveGuestTeaAction");
  });

  it("refuses a cookie whose token matches no guest", async () => {
    vi.mocked(getGuestParticipationByToken).mockResolvedValue(null);

    const result = await saveGuestTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: INVALID_LINK, success: false });
    expectNoWrites("saveGuestTeaAction");
  });

  it("saves, without a session, as the guest of the cookie and for their participation only", async () => {
    const form = teaForm();
    form.set("token", "form-token");
    form.set("participationId", "someone-elses-participation");
    form.set("tea_id", "someone-elses-tea");

    await saveGuestTeaAction(null, form);

    expect(getGuestParticipationByToken).toHaveBeenCalledWith("cookie-token");
    expect(getGuestParticipationByToken).not.toHaveBeenCalledWith("form-token");
    const { actor, participationId } = serviceCall();
    expect(actor).toEqual({ kind: "guest", participationId: "guest-participation-id" });
    expect(participationId).toBe("guest-participation-id");
    expect(getTeaById).not.toHaveBeenCalled();
  });

  it("hands the service the tea and the story of the form", async () => {
    await saveGuestTeaAction(null, teaForm());

    const { submission } = serviceCall();
    expect(submission.content).toMatchObject({ infusionTime: 4, name: "Té editado", temperature: 85 });
    expect(submission.story).toMatchObject({ storyPart1: "Érase una vez" });
  });

  it("answers an invalid form with its errors and what was typed, and never calls the service", async () => {
    const result = await saveGuestTeaAction(null, invalid(teaForm()));

    expect(result).toMatchObject({ message: INVALID_FORM, success: false });
    expect(result.errors).toBeDefined();
    expect(result.inputs).toBeDefined();
    expectNoWrites("saveGuestTeaAction");
  });

  it("says the tea was saved when it was created, and refreshes the guest page", async () => {
    const result = await saveGuestTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "Té guardado.", success: true });
    expect(revalidatePath).toHaveBeenCalledWith("/invitado");
  });

  it("says the tea was updated when it already existed", async () => {
    vi.mocked(saveTeaForParticipation).mockResolvedValue({ created: false });

    const result = await saveGuestTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "Té actualizado.", success: true });
  });

  it("passes a conflict of the service on as it is", async () => {
    const error = new ConflictError(
      "Tu día ya ha abierto y tu té ya no se puede cambiar. Si hay un error, avisa al GerenTé.",
    );
    vi.mocked(saveTeaForParticipation).mockRejectedValue(error);

    const result = await saveGuestTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: error.message, success: false });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers an unexpected failure with a generic message", async () => {
    vi.mocked(saveTeaForParticipation).mockRejectedValue(new Error("connection lost to db.internal:5432"));

    const result = await saveGuestTeaAction(null, teaForm());

    expect(result).toMatchObject({ message: "No se pudo guardar el té. Inténtalo de nuevo.", success: false });
  });
});
