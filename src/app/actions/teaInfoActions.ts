"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { uploadImage } from "@/lib/cloudinary";
import {
  addDay,
  addStoryImage,
  addStoryTea,
  addTea,
  assignDay,
  getActiveEdition,
  getDayByDayNumber,
  getOpenParticipationByUserId,
  getTeaById,
  requireSession,
  verifySession,
} from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { teaFormSchema, teaInfoFormSchema } from "@/lib/schemas/tea";
import { saveTeaForParticipation, TeaSubmission } from "@/lib/services/participation-tea-service";
import { TeaFormData, TeaInfoActionResponse, TeaInfoFormData } from "@/lib/types";

import { getFormBoolean, getFormFilesByPrefix, getFormNumber, getFormString } from "./commonActions";

export async function addTeaInfo(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  try {
    const { isAuth, userId } = await verifySession();
    const edition = await getActiveEdition();
    if (!edition) {
      return {
        errors: { errors: ["No active edition found"] },
        message: "No active edition found",
        success: false,
      };
    }
    const rawData: TeaInfoFormData = {
      addMilk: getFormBoolean(formData, "addMilk"),
      canReinfuse: getFormBoolean(formData, "canReinfuse"),
      dayNumber: getFormNumber(formData, "dayNumber"),
      hasTheine: getFormBoolean(formData, "hasTheine"),
      images: getFormFilesByPrefix(formData, "image"),
      infusionTime: getFormNumber(formData, "infusionTime"),
      moreIndications: getFormString(formData, "moreIndications") || undefined,
      onlyMusic: getFormBoolean(formData, "onlyMusic"),
      personName: getFormString(formData, "personName"),
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
    const validatedFields = teaInfoFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
        message: "Hay errores en el formulario",
        success: false,
      };
    }

    const data = validatedFields.data;
    let dayNumber = data.dayNumber;
    if (data.dayNumber === 0) {
      dayNumber = Math.floor(Math.random() * 50000) + 25;
      await addDay({ dayNumber, year: edition.year });
    }
    const dayRecord = await getDayByDayNumber({ dayNumber, year: edition.year });
    if (!dayRecord) {
      throw new Error(`Day ${dayNumber}/${edition.year} does not exist`);
    }
    // The participation comes first: the tea hangs from it.
    const participation = await assignDay(dayRecord.id, isAuth ? { userId } : { guestName: data.personName });
    const teaCreated = await addTea(
      {
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
      [],
      participation.id,
    );
    if (
      data.storyPart1 ||
      data.storyPart2 ||
      data.storyPart3 ||
      data.youtubeURL ||
      data.onlyMusic ||
      (data.images && data.images.length > 0)
    ) {
      const storyCreated = await addStoryTea(
        {
          onlyMusic: data.onlyMusic,
          storyPart1: data.storyPart1,
          storyPart2: data.storyPart2,
          storyPart3: data.storyPart3,
          youtubeURL: data.youtubeURL,
        },
        teaCreated.id,
      );
      if (!storyCreated) {
        throw new Error("Cannot create story tea");
      }
      if (data.images) {
        const publicIds = await Promise.all(
          data.images.map(async (image) => await uploadImage(image, { kind: "teaDay", year: edition.year })),
        );
        for (const [i, publicId] of publicIds.entries()) {
          if (publicId) {
            await addStoryImage(publicId, i, storyCreated.id);
          }
        }
      }
    }

    return {
      message: "Té guardado",
      success: true,
    };
  } catch (error: unknown) {
    // A conflict here would name the day's holder to whoever submitted, guests included: keep it generic.
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[addTeaInfo] rejected: ${error.name} — ${error.message}`);
    } else {
      console.error("[addTeaInfo] unexpected error", error);
    }
    const message = isGuardError ? error.message : "No se pudo guardar el té. Inténtalo de nuevo.";
    return {
      errors: { errors: [message] },
      message,
      success: false,
    };
  }
}

// Shared by the two forms that save a tea through its participation: no person name and no day here.
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
    const { created } = await saveTeaForParticipation({ id: userId, role }, participation.id, parsed.submission);
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
    const { created } = await saveTeaForParticipation({ id: userId, role }, tea.participation.id, parsed.submission);
    revalidatePath("/my-tea");
    revalidatePath(`/editions/${tea.participation.year}`);
    return { message: created ? "Té guardado." : "Té actualizado.", success: true };
  } catch (error: unknown) {
    return toTeaFailure("editTeaInfoAction", error, "No se pudo actualizar el té. Inténtalo de nuevo.", inputs);
  }
}
