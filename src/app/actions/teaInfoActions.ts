"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { deleteAsset, uploadImage } from "@/lib/cloudinary";
import {
  add25Days,
  addDay,
  addStoryImage,
  addStoryTea,
  addTea,
  assignDay,
  deleteDay,
  editStoryTea,
  getActiveEdition,
  getTeaById,
  replaceStoryImages,
  requireRole,
  requireSession,
  StoryImageSlot,
  unassignDay,
  updateTeaContent,
  verifySession,
} from "@/lib/dal";
import { ConflictError, ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { teaInfoFormSchema } from "@/lib/schemas/tea";
import { userCanEditTea } from "@/lib/services/tea-edit-service";
import { ActionResponse, TeaInfoActionResponse, TeaInfoFormData } from "@/lib/types";

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
    let day = data.dayNumber;
    if (data.dayNumber === 0) {
      day = Math.floor(Math.random() * 50000) + 25;
      await addDay({ dayNumber: day, year: edition.year });
    }
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
      {
        dayNumber: day,
        year: edition.year,
      },
    );
    if (!teaCreated) {
      throw new Error("Cannot create tea");
    }
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

    if (isAuth) {
      await assignDay(teaCreated.dayId!, { userId });
    } else {
      await assignDay(teaCreated.dayId!, { guestName: data.personName });
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

export async function editTeaInfoAction(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  try {
    const { role, userId } = await requireSession();

    const rawData: TeaInfoFormData = {
      addMilk: getFormBoolean(formData, "addMilk"),
      canReinfuse: getFormBoolean(formData, "canReinfuse"),
      dayNumber: getFormNumber(formData, "dayNumber"),
      hasTheine: getFormBoolean(formData, "hasTheine"),
      images: getFormFilesByPrefix(formData, "image"),
      imagesOrder: (formData.getAll("images_order") as Array<string>) || undefined,
      infusionTime: getFormNumber(formData, "infusionTime"),
      keptImages: (formData.getAll("kept_images") as Array<string>) || undefined,
      keptImagesOrder: (formData.getAll("kept_images_order") as Array<string>) || undefined,
      moreIndications: getFormString(formData, "moreIndications") || undefined,
      onlyMusic: getFormBoolean(formData, "onlyMusic"),
      personName: getFormString(formData, "personName"),
      reinfuseNumber: getFormNumber(formData, "reinfuseNumber") || undefined,
      storeName: getFormString(formData, "storeName") || undefined,
      storyPart1: getFormString(formData, "storyPart1"),
      storyPart2: getFormString(formData, "storyPart2"),
      storyPart3: getFormString(formData, "storyPart3"),
      teaId: getFormString(formData, "tea_id"),
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
    if (!data.teaId) throw new Error("Tea id is missing.");

    const currentTea = await getTeaById(data.teaId);
    if (!currentTea) throw new Error(`Cannot find tea with id ${data.teaId}`);
    if (!currentTea.day || !(await userCanEditTea({ id: userId, role }, currentTea))) {
      throw new ForbiddenError("No puedes editar este té.");
    }
    const year = currentTea.day.year;
    let storyId = currentTea.story?.id || null;

    await updateTeaContent(data.teaId, {
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
    });

    if (data.storyPart1 || data.storyPart2 || data.storyPart3 || data.youtubeURL || data.onlyMusic) {
      const formStoryTea = {
        onlyMusic: data.onlyMusic,
        storyPart1: data.storyPart1,
        storyPart2: data.storyPart2,
        storyPart3: data.storyPart3,
        youtubeURL: data.youtubeURL,
      };
      if (currentTea.story) {
        const editedStory = await editStoryTea(formStoryTea, currentTea.story.id);
        if (!editedStory) throw new Error("Cannot edit story tea");
      } else {
        const addedStory = await addStoryTea(formStoryTea, currentTea.id);
        if (!addedStory) throw new Error("Cannot edit story tea");
        storyId = addedStory.id;
      }
    }
    // The form sends the final image list split in two channels (kept ids + new files), each with its
    // absolute position. Rebuild that list; anything not in it is deleted by replaceStoryImages.
    const newImages = data.images ?? [];
    const slotsByPosition: Array<StoryImageSlot | undefined> = [];
    (data.keptImages ?? []).forEach((id, i) => {
      slotsByPosition[data.keptImagesOrder?.[i] ?? i] = { id, kind: "existing" };
    });
    if (newImages.length > 0) {
      const publicIds = await Promise.all(newImages.map((image) => uploadImage(image, { kind: "teaDay", year })));
      publicIds.forEach((publicId, i) => {
        if (publicId) slotsByPosition[data.imagesOrder?.[i] ?? slotsByPosition.length] = { kind: "new", publicId };
      });
    }
    const slots = slotsByPosition.filter((slot): slot is StoryImageSlot => slot !== undefined);

    if (storyId || slots.length > 0) {
      if (!storyId) {
        const addedStory = await addStoryTea({}, currentTea.id);
        storyId = addedStory.id;
      }
      const removedPublicIds = await replaceStoryImages(storyId, slots);
      // Best effort, after the transaction has committed: a failed asset deletion must not undo the edit.
      await Promise.all(removedPublicIds.map((publicId) => deleteAsset(publicId)));
    }

    return {
      message: "Té actualizado",
      success: true,
    };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[editTeaInfoAction] rejected: ${error.name} — ${error.message}`);
    } else {
      console.error("[editTeaInfoAction] unexpected error", error);
    }
    const message = isGuardError ? error.message : "No se pudo actualizar el té. Inténtalo de nuevo.";
    return {
      errors: { errors: [message] },
      message,
      success: false,
    };
  }
}

export async function assignUserToDay(dayId: string, value: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    if (!value) {
      await unassignDay(dayId);
      revalidatePath("/edit-tea-info");
      return { message: "Asignación eliminada", success: true };
    }
    await assignDay(dayId, { userId: value });
    revalidatePath("/edit-tea-info");
    return { message: "Asignación actualizada", success: true };
  } catch (error: unknown) {
    const isGuardError =
      error instanceof UnauthenticatedError || error instanceof ForbiddenError || error instanceof ConflictError;
    const isAlreadyAssigned = error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
    if (isGuardError || isAlreadyAssigned) {
      console.warn(`[assignUserToDay] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[assignUserToDay] unexpected error", error);
    }
    let message = "No se pudo guardar la asignación. Inténtalo de nuevo.";
    if (isGuardError) message = error.message;
    else if (isAlreadyAssigned) message = "Esa persona ya tiene un día asignado este año.";
    return { message, success: false };
  }
}

export async function addDaysAction(year: number): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await add25Days(year);
    revalidatePath("/edit-tea-info");
    return { message: "Días creados", success: true };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[addDaysAction] rejected: ${error.name} — year=${year} — ${error.message}`);
    } else {
      console.error("[addDaysAction] unexpected error", error);
    }
    return {
      message: isGuardError ? error.message : "No se pudieron crear los días. Inténtalo de nuevo.",
      success: false,
    };
  }
}

export async function deleteDayAction(dayId: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await deleteDay(dayId);
    revalidatePath("/edit-tea-info");
    return { message: "Día borrado", success: true };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[deleteDayAction] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[deleteDayAction] unexpected error", error);
    }
    return {
      message: isGuardError ? error.message : "No se pudo borrar el día. Inténtalo de nuevo.",
      success: false,
    };
  }
}
