"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { getGuestParticipationByToken, getOpenParticipationByUserId, getTeaById, requireSession } from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { GUEST_COOKIE } from "@/lib/guest-cookie";
import { teaFormSchema } from "@/lib/schemas/tea";
import { saveTeaForParticipation, TeaSubmission } from "@/lib/services/participation-tea-service";
import { TeaFormData, TeaInfoActionResponse } from "@/lib/types";

import { getFormBoolean, getFormFilesByPrefix, getFormNumber, getFormString } from "./commonActions";

// Shared by the forms that save a tea through its participation: no person name and no day here.
function toTeaFormData(formData: FormData): TeaFormData {
  return {
    addMilk: getFormBoolean(formData, "addMilk"),
    canReinfuse: getFormBoolean(formData, "canReinfuse"),
    hasTheine: getFormBoolean(formData, "hasTheine"),
    images: getFormFilesByPrefix(formData, "image"),
    imagesOrder: formData.getAll("images_order") as Array<string>,
    infusionTime: getFormNumber(formData, "infusionTime"),
    keptImages: formData.getAll("kept_images") as Array<string>,
    keptImagesOrder: formData.getAll("kept_images_order") as Array<string>,
    moreIndications: getFormString(formData, "moreIndications") || undefined,
    onlyMusic: getFormBoolean(formData, "onlyMusic"),
    reinfuseNumber: getFormNumber(formData, "reinfuseNumber") || undefined,
    storeName: getFormString(formData, "storeName") || undefined,
    storyPart1: getFormString(formData, "storyPart1"),
    storyPart2: getFormString(formData, "storyPart2"),
    storyPart3: getFormString(formData, "storyPart3"),
    teaName: getFormString(formData, "teaName"),
    temperature: getFormNumber(formData, "temperature"),
    urlStore: getFormString(formData, "urlStore") || undefined,
    youtubeURL: getFormString(formData, "youtubeURL") || undefined,
  };
}

function toTeaSubmission(data: z.infer<typeof teaFormSchema>): TeaSubmission {
  const keptImages = data.keptImages ?? [];
  return {
    content: {
      addMilk: data.addMilk,
      canReinfuse: data.canReinfuse,
      hasTheine: data.hasTheine,
      infusionTime: data.infusionTime,
      moreIndications: data.moreIndications,
      name: data.teaName,
      reinfuseNumber: data.reinfuseNumber,
      storeName: data.storeName,
      temperature: data.temperature,
      url: data.urlStore,
    },
    keptImages: keptImages.map((id, i) => ({ id, order: data.keptImagesOrder?.[i] ?? i })),
    // A file sent without its position goes after the kept images.
    newImages: (data.images ?? []).map((file, i) => ({ file, order: data.imagesOrder?.[i] ?? keptImages.length + i })),
    story: {
      onlyMusic: data.onlyMusic,
      storyPart1: data.storyPart1,
      storyPart2: data.storyPart2,
      storyPart3: data.storyPart3,
      youtubeURL: data.youtubeURL,
    },
  };
}

type ParsedTeaForm = { inputs: TeaFormData; submission: TeaSubmission } | { response: TeaInfoActionResponse };

function parseTeaForm(formData: FormData): ParsedTeaForm {
  const inputs = toTeaFormData(formData);
  const validatedFields = teaFormSchema.safeParse(inputs);
  if (!validatedFields.success) {
    return {
      response: {
        errors: z.treeifyError(validatedFields.error),
        inputs,
        message: "Hay errores en el formulario",
        success: false,
      },
    };
  }
  return { inputs, submission: toTeaSubmission(validatedFields.data) };
}

// Guard and conflict errors carry a message meant for the user; anything else gets the fallback.
function toTeaFailure(
  action: string,
  error: unknown,
  fallback: string,
  inputs: TeaFormData | undefined,
): TeaInfoActionResponse {
  const isExpected =
    error instanceof UnauthenticatedError || error instanceof ForbiddenError || error instanceof ConflictError;
  if (isExpected) {
    console.warn(`[${action}] rejected: ${error.name} — ${error.message}`);
  } else {
    console.error(`[${action}] unexpected error`, error);
  }
  const response: TeaInfoActionResponse = { message: isExpected ? error.message : fallback, success: false };
  // The form is reset after the action: the inputs let it show what was typed instead of the saved tea.
  return inputs ? { ...response, inputs } : response;
}

/** Saves the tea of the signed-in user's open participation, whatever the form says about which tea it is. */
export async function saveMyTeaAction(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  let inputs: TeaFormData | undefined;
  try {
    const { role, userId } = await requireSession();
    const parsed = parseTeaForm(formData);
    if ("response" in parsed) {
      return parsed.response;
    }
    inputs = parsed.inputs;

    const participation = await getOpenParticipationByUserId(userId);
    if (!participation) {
      return { message: "No estás inscrito en ninguna edición abierta.", success: false };
    }
    const { created } = await saveTeaForParticipation(
      { id: userId, kind: "user", role },
      participation.id,
      parsed.submission,
    );
    revalidatePath("/my-tea");
    return { message: created ? "Té guardado." : "Té actualizado.", success: true };
  } catch (error: unknown) {
    return toTeaFailure("saveMyTeaAction", error, "No se pudo guardar el té. Inténtalo de nuevo.", inputs);
  }
}

/** The managers' editor: saves the tea named by `tea_id`, if the signed-in user may edit it. */
export async function editTeaInfoAction(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  let inputs: TeaFormData | undefined;
  try {
    const { role, userId } = await requireSession();
    const parsed = parseTeaForm(formData);
    if ("response" in parsed) {
      return parsed.response;
    }
    inputs = parsed.inputs;

    const teaId = getFormString(formData, "tea_id");
    const tea = teaId ? await getTeaById(teaId) : null;
    if (!tea) {
      return { message: "Ese té ya no existe.", success: false };
    }
    const { created } = await saveTeaForParticipation(
      { id: userId, kind: "user", role },
      tea.participation.id,
      parsed.submission,
    );
    revalidatePath("/my-tea");
    revalidatePath(`/editions/${tea.participation.year}`);
    return { message: created ? "Té guardado." : "Té actualizado.", success: true };
  } catch (error: unknown) {
    return toTeaFailure("editTeaInfoAction", error, "No se pudo actualizar el té. Inténtalo de nuevo.", inputs);
  }
}

/**
 * Saves a guest's tea. Public on purpose: the guest has no account, and the secret token of their link, read
 * only from its cookie, is what names their participation. Nothing in the form can point at another one.
 */
export async function saveGuestTeaAction(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  let inputs: TeaFormData | undefined;
  try {
    const token = (await cookies()).get(GUEST_COOKIE)?.value;
    const participation = token ? await getGuestParticipationByToken(token) : null;
    if (!participation) {
      return { message: "Este enlace no es válido o ha caducado. Pide uno nuevo al GerenTé.", success: false };
    }
    const parsed = parseTeaForm(formData);
    if ("response" in parsed) {
      return parsed.response;
    }
    inputs = parsed.inputs;

    const { created } = await saveTeaForParticipation(
      { kind: "guest", participationId: participation.id },
      participation.id,
      parsed.submission,
    );
    revalidatePath("/invitado");
    return { message: created ? "Té guardado." : "Té actualizado.", success: true };
  } catch (error: unknown) {
    return toTeaFailure("saveGuestTeaAction", error, "No se pudo guardar el té. Inténtalo de nuevo.", inputs);
  }
}
