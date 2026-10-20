"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import { Role } from "@/generated/prisma/enums";
import { deleteAsset } from "@/lib/cloudinary";
import { uploadImageFile } from "@/lib/cloudinary";
import {
  add25Days,
  addDay,
  addDayAssignment,
  addStoryImage,
  addStoryTea,
  addTea,
  deleteDay,
  deleteDayAssignmentByDay,
  editStoryTea,
  editTea,
  getDayAssignmentByUserId,
  getTea,
  replaceStoryImages,
  requireRole,
  requireSession,
  StoryImageSlot,
  upsertDayAssignment,
  verifySession,
} from "@/lib/dal";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { teaInfoFormSchema } from "@/lib/schemas/tea";
import { ActionResponse, TeaInfoActionResponse, TeaInfoFormData } from "@/lib/types";

import { getFormBoolean, getFormFilesByPrefix, getFormNumber, getFormString } from "./commonActions";

export async function addTeaInfo(
  prevState: null | TeaInfoActionResponse,
  formData: FormData,
): Promise<TeaInfoActionResponse> {
  try {
    const { isAuth, userId } = await verifySession();
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
      await addDay(day);
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
      day,
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
        const publicIds = await Promise.all(data.images.map(async (image) => await uploadImageFile(image, "teaDay")));
        for (const [i, publicId] of publicIds.entries()) {
          if (publicId) {
            await addStoryImage(publicId, i, storyCreated.id);
          }
        }
      }
    }

    const dayAssignmentCreated = isAuth
      ? await addDayAssignment({ userId: userId }, day)
      : await addDayAssignment({ guestName: data.personName }, day);
    if (!dayAssignmentCreated) {
      throw new Error(
        `Cannot create dayAssignment for user ${isAuth ? userId : data.personName} in day with id ${teaCreated.dayId}`,
      );
    }
    return {
      message: "Té guardado",
      success: true,
    };
  } catch (error: unknown) {
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

    const day = data.dayNumber;
    const currentTea = await getTea(data.teaId);
    if (!currentTea) throw new Error(`Cannot find tea with id ${data.teaId}`);
    const isPrivileged = role === Role.ADMIN || role === Role.EXECUTEAVE;
    if (!isPrivileged) {
      if (!currentTea.day) throw new ForbiddenError("Sólo puedes editar tu día asignado.");
      const assignment = await getDayAssignmentByUserId(userId, currentTea.day.year);
      if (!assignment) throw new ForbiddenError("No tienes un día asignado para este año.");
      if (currentTea.dayId !== assignment.dayId) {
        throw new ForbiddenError("Sólo puedes editar tu día asignado.");
      }
    }

    let storyId = currentTea.story?.id || null;
    let newDayNumber: number | undefined = undefined;
    if (isPrivileged) {
      newDayNumber = currentTea.day?.dayNumber === day ? undefined : day;
    }
    const editedTea = await editTea(
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
      data.teaId,
      newDayNumber,
    );
    if (!editedTea) {
      throw new Error("Cannot edit tea");
    }

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
      const publicIds = await Promise.all(newImages.map((image) => uploadImageFile(image, "teaDay")));
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

export async function assignUserToDay(
  dayId: string,
  userId: string,
  year: number = 2025,
  guestName?: string,
): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    if (!userId && !guestName) {
      await deleteDayAssignmentByDay(dayId);
      revalidatePath("/edit-tea-info");
      return { message: "Asignación eliminada", success: true };
    }

    const assignment = { dayId, guestName: guestName || null, userId: userId || null, year };
    if (assignment.userId && assignment.guestName) {
      assignment.guestName = null;
    }

    await upsertDayAssignment(dayId, assignment);
    revalidatePath("/edit-tea-info");
    return { message: "Asignación actualizada", success: true };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
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

export async function addDaysAction(year: number = 2025): Promise<ActionResponse> {
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
