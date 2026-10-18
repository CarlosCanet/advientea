"use server";
import { Role } from "@/generated/prisma/enums";
import { add25Days, addDay, addDayAssignment, addStoryImage, addStoryTea, addTea, deleteDay, deleteDayAssignmentByDay, deleteStoryImage, editStoryTea, editTea, getDayAssignmentByUserId, getTea, reorderStoryImages, requireRole, requireSession, upsertDayAssignment, verifySession } from "@/lib/dal";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { teaInfoFormSchema } from "@/lib/schemas/tea";
import { ActionResponse, TeaInfoActionResponse, TeaInfoFormData } from "@/lib/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getFormBoolean, getFormFilesByPrefix, getFormNumber, getFormString } from "./commonActions";
import { uploadImageCloudinary } from "./uploadActions";

export async function addTeaInfo(prevState: TeaInfoActionResponse | null, formData: FormData): Promise<TeaInfoActionResponse> {
  try {
    const {isAuth, userId} = await verifySession();
    const rawData: TeaInfoFormData = {
      personName: getFormString(formData, "personName"),
      dayNumber: getFormNumber(formData, "dayNumber"),
      teaName: getFormString(formData, "teaName"),
      temperature: getFormNumber(formData, "temperature"),
      infusionTime: getFormNumber(formData, "infusionTime"),
      hasTheine: getFormBoolean(formData, "hasTheine"),
      addMilk: getFormBoolean(formData, "addMilk"),
      canReinfuse: getFormBoolean(formData, "canReinfuse"),
      reinfuseNumber: getFormNumber(formData, "reinfuseNumber") || undefined,
      moreIndications: getFormString(formData, "moreIndications") || undefined,
      storeName: getFormString(formData, "storeName") || undefined,
      urlStore: getFormString(formData, "urlStore") || undefined,
      storyPart1: getFormString(formData, "storyPart1"),
      storyPart2: getFormString(formData, "storyPart2"),
      storyPart3: getFormString(formData, "storyPart3"),
      youtubeURL: getFormString(formData, "youtubeURL") || undefined,
      onlyMusic: getFormBoolean(formData, "onlyMusic"),
      images: getFormFilesByPrefix(formData, "image"),
    };
    const validatedFields = teaInfoFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
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
        name: data.teaName,
        infusionTime: data.infusionTime,
        temperature: data.temperature,
        hasTheine: data.hasTheine,
        canReinfuse: data.canReinfuse,
        reinfuseNumber: data.reinfuseNumber,
        moreIndications: data.moreIndications,
        addMilk: data.addMilk,
        storeName: data.storeName,
        url: data.urlStore,
      },
      [],
      day
    );
    if (!teaCreated) {
      throw new Error("Cannot create tea");
    }
    if (data.storyPart1 || data.storyPart2 || data.storyPart3 || data.youtubeURL || data.onlyMusic || (data.images && data.images.length > 0)) {
      const storyCreated = await addStoryTea(
        {
          storyPart1: data.storyPart1,
          storyPart2: data.storyPart2,
          storyPart3: data.storyPart3,
          youtubeURL: data.youtubeURL,
          onlyMusic: data.onlyMusic,
        },
        teaCreated.id
      );
      if (!storyCreated) {
        throw new Error("Cannot create story tea");
      }
      if (data.images) {
        const publicIds = await Promise.all(data.images.map(async (image) => await uploadImageCloudinary(image, "teaDay")));
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
      throw new Error(`Cannot create dayAssignment for user ${isAuth ? userId : data.personName} in day with id ${teaCreated.dayId}`);
    }
    return {
      success: true,
      message: "Té guardado",
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
      success: false,
      message,
      errors: { errors: [message] },
    };
  }
}

export async function editTeaInfoAction(prevState: TeaInfoActionResponse | null, formData: FormData): Promise<TeaInfoActionResponse> {
  try {
    const { role, userId } = await requireSession();
    
    const rawData: TeaInfoFormData = {
      personName: getFormString(formData, "personName"),
      dayNumber: getFormNumber(formData, "dayNumber"),
      teaName: getFormString(formData, "teaName"),
      temperature: getFormNumber(formData, "temperature"),
      infusionTime: getFormNumber(formData, "infusionTime"),
      hasTheine: getFormBoolean(formData, "hasTheine"),
      addMilk: getFormBoolean(formData, "addMilk"),
      canReinfuse: getFormBoolean(formData, "canReinfuse"),
      reinfuseNumber: getFormNumber(formData, "reinfuseNumber") || undefined,
      moreIndications: getFormString(formData, "moreIndications") || undefined,
      storeName: getFormString(formData, "storeName") || undefined,
      urlStore: getFormString(formData, "urlStore") || undefined,
      storyPart1: getFormString(formData, "storyPart1"),
      storyPart2: getFormString(formData, "storyPart2"),
      storyPart3: getFormString(formData, "storyPart3"),
      youtubeURL: getFormString(formData, "youtubeURL") || undefined,
      onlyMusic: getFormBoolean(formData, "onlyMusic"),
      images: getFormFilesByPrefix(formData, "image"),
      imagesOrder: (formData.getAll("images_order") as Array<string>) || undefined,
      keptImages: (formData.getAll("kept_images") as Array<string>) || undefined,
      keptImagesOrder: (formData.getAll("kept_images_order") as Array<string>) || undefined,
      deleteImages: (formData.getAll("delete_images") as Array<string>) || undefined,
      teaId: getFormString(formData, "tea_id"),
    };
    const validatedFields = teaInfoFormSchema.safeParse(rawData);
    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
      };
    }
    
    const data = validatedFields.data;
    if (!data.teaId) throw new Error("Tea id is missing.");
    
    const day = data.dayNumber;
    const currentTea = await getTea(data.teaId);
    if (!currentTea) throw new Error(`Cannot find tea with id ${data.teaId}`);
    if(role === Role.USER){
      if (!currentTea.day) throw new Error(`Cannot find day for tea with id ${data.teaId}`);
      const assignment = await getDayAssignmentByUserId(userId, currentTea.day.year);
      if (!assignment) throw new ForbiddenError("No tienes un día asignado para este año.");
      if(currentTea.dayId !== assignment.dayId){
        throw new ForbiddenError("Sólo puedes editar tu día asignado.");
      }
    }

    let storyId = currentTea.story?.id || null;
    let newDayNumber: number | undefined = undefined;
    if(role !== Role.USER){
      newDayNumber = currentTea.day?.dayNumber === day ? undefined : day;
    }
    const editedTea = await editTea({
      name: data.teaName,
      infusionTime: data.infusionTime,
      temperature: data.temperature,
      hasTheine: data.hasTheine,
      canReinfuse: data.canReinfuse,
      reinfuseNumber: data.reinfuseNumber,
      moreIndications: data.moreIndications,
      addMilk: data.addMilk,
      storeName: data.storeName,
      url: data.urlStore,
    }, data.teaId, newDayNumber);
    if (!editedTea) {
      throw new Error("Cannot edit tea");
    }

    if (data.storyPart1 || data.storyPart2 || data.storyPart3 || data.youtubeURL || data.onlyMusic) {
      const formStoryTea = {
        storyPart1: data.storyPart1,
        storyPart2: data.storyPart2,
        storyPart3: data.storyPart3,
        youtubeURL: data.youtubeURL,
        onlyMusic: data.onlyMusic,
      }
      if (currentTea.story) {
        const editedStory = await editStoryTea( formStoryTea, currentTea.story.id);
        if (!editedStory) throw new Error("Cannot edit story tea");
      } else {
        const addedStory = await addStoryTea(formStoryTea, currentTea.id)
        if (!addedStory) throw new Error("Cannot edit story tea");
        storyId = addedStory.id;
      }
    }
    if (data.images && data.imagesOrder) {
      if (!storyId) {
        const addedStory = await addStoryTea({}, currentTea.id);
        storyId = addedStory.id;
      }
      const publicIds = await Promise.all(data.images.map(async (image) => await uploadImageCloudinary(image, "teaDay")));
      for (const [i, publicId] of publicIds.entries()) {
        if (publicId) {
          await addStoryImage(publicId, data.imagesOrder[i], storyId);
        }
      }
    }
    if (data.keptImages && data.keptImagesOrder) {
      const images = data.keptImages;
      const order = data.keptImagesOrder;
      await reorderStoryImages(images, order);
    }

    if (data.deleteImages) {
      for (const id of data.deleteImages) {
        await deleteStoryImage(id);
      }
    }

    return {
      success: true,
      message: "Té actualizado",
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
      success: false,
      message,
      errors: { errors: [message] },
    };
  }
}

export async function assignUserToDay(dayId: string, userId: string, year: number = 2025, guestName?: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    if (!userId && !guestName) {
      await deleteDayAssignmentByDay(dayId);
      revalidatePath("/edit-tea-info");
      return { success: true, message: "Asignación eliminada" };
    }

    const assignment = { dayId, year, userId: userId || null, guestName: guestName || null };
    if (assignment.userId && assignment.guestName) {
      assignment.guestName = null;
    }

    await upsertDayAssignment(dayId, assignment);
    revalidatePath("/edit-tea-info");
    return { success: true, message: "Asignación actualizada" };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[assignUserToDay] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[assignUserToDay] unexpected error", error);
    }
    return {
      success: false,
      message: isGuardError ? error.message : "No se pudo guardar la asignación. Inténtalo de nuevo.",
    };
  }
}

export async function addDaysAction(year: number = 2025): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN, Role.EXECUTEAVE);
    await add25Days(year);
    revalidatePath("/edit-tea-info");
    return { success: true, message: "Días creados" };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[addDaysAction] rejected: ${error.name} — year=${year} — ${error.message}`);
    } else {
      console.error("[addDaysAction] unexpected error", error);
    }
    return {
      success: false,
      message: isGuardError ? error.message : "No se pudieron crear los días. Inténtalo de nuevo.",
    };
  }
}

export async function deleteDayAction(dayId: string): Promise<ActionResponse> {
  try {
    await requireRole(Role.ADMIN);
    await deleteDay(dayId);
    revalidatePath("/edit-tea-info");
    return { success: true, message: "Día borrado" };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[deleteDayAction] rejected: ${error.name} — dayId=${dayId} — ${error.message}`);
    } else {
      console.error("[deleteDayAction] unexpected error", error);
    }
    return {
      success: false,
      message: isGuardError ? error.message : "No se pudo borrar el día. Inténtalo de nuevo.",
    };
  }
}