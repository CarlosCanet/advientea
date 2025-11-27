"use server";
import { z } from "zod";
import { uploadImageCloudinary } from "./uploadActions";
import { TeaInfoActionResponse, TeaInfoFormData } from "@/lib/types";
import { getFormBoolean, getFormFilesByPrefix, getFormNumber, getFormString } from "./commonActions";
import { addDay, addStoryImage, addStoryTea, addTea, deleteStoryImage, editStoryTea, editTea } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

// Schema de validación con Zod
const TeaInfoFormSchema = z.object({
  personName: z.string().trim().min(1, "El nombre es requerido"),
  dayNumber: z.number().min(0, "Día mínimo: 0").max(25, "Día máximo: 25"),
  teaName: z.string().trim().min(1, "El nombre del té es requerido"),
  temperature: z.number().min(30, "Temperatura mínima: 30°C").max(150, "Temperatura máxima: 150°C"),
  infusionTime: z.number().min(1, "Tiempo mínimo: 1 min").max(30, "Tiempo máximo: 30 min"),
  hasTheine: z.boolean(),
  addMilk: z.boolean(),
  canReinfuse: z.boolean(),
  reinfuseNumber: z.number().optional(),
  moreIndications: z.string().optional(),
  storeName: z.string().optional(),
  urlStore: z.url("URL inválida. Debe empezar por http:// o https://.").optional(),
  storyPart1: z.string().optional(),
  storyPart2: z.string().optional(),
  storyPart3: z.string().optional(),
  youtubeURL: z.url("URL de YouTube inválida. Debe empezar por http:// o https://.").includes("youtube.com").optional(),
  onlyMusic: z.boolean(),
  images: z
    .array(z
      .file()
      .max(1 * 1024 * 1024, { error: "Tamaño de imagen demasiado grande (max 2 MB)." })
      .mime(["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"], {
        error: "Formato de archivo no permitido.",
      }),
    )
    .optional(),
  imagesOrder: z.array(z.coerce.number()).optional(),
  keptImages: z.array(z.string()).optional(),
  keptImagesOrder: z.array(z.coerce.number()).optional(),
  deleteImages: z.array(z.string()).optional()
});

export async function addTeaInfo(prevState: TeaInfoActionResponse | null, formData: FormData): Promise<TeaInfoActionResponse> {
  try {
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
    const validatedFields = TeaInfoFormSchema.safeParse(rawData)
    
    if (!validatedFields.success) {
      const myErrors = z.treeifyError(validatedFields.error);
      console.log("Validation errors:");
      console.dir(myErrors, { depth: null });
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData
      }
    }

    
    const data = validatedFields.data;
    let day = data.dayNumber;
    if (data.dayNumber === 0) {
      day = Math.floor(Math.random() * 50000);
      await addDay(day);
    }
    const teaCreated = await addTea({
      name: data.teaName,
      infusionTime: data.infusionTime,
      temperature: data.temperature,
      hasTheine: data.hasTheine,
      canReinfuse: data.canReinfuse,
      reinfuseNumber: data.reinfuseNumber,
      moreIndications: data.moreIndications,
      addMilk: data.addMilk,
      storeName: data.storeName,
      url: data.urlStore
    }, day);
    if (!teaCreated) {
      throw new Error("Cannot create tea");
    }
    if (data.storyPart1 || data.storyPart2 || data.storyPart3 || data.youtubeURL ||data.onlyMusic || (data.images && data.images.length > 0)) {
      const storyCreated = await addStoryTea({
        storyPart1: data.storyPart1,
        storyPart2: data.storyPart2,
        storyPart3: data.storyPart3,
        youtubeURL: data.youtubeURL,
        onlyMusic: data.onlyMusic
      }, day)
      if (!storyCreated) {
        throw new Error("Cannot create story tea");
      }
      if (data.images) {
        const publicIds = await Promise.all(data.images.map(async (image) => await uploadImageCloudinary(image, "teaDay") ));
        for (const [i, publicId] of publicIds.entries()){
          if (publicId) {
            await addStoryImage(publicId, i, day)
          } 
        }
      }
    }
    console.log(`Tea with name ${data.teaName} for day ${day}/2025 added successfully.`);
    return {
      success: true,
      message: "Tea created successfully"
    }
  } catch (error) {
    console.error("Validation error:", error)
    let errorMsg = "";
    if (error && typeof(error) === "object" && "message" in error) {
      errorMsg = (error.message === "User already exists. Use another email.") ? "Ya existe un usuario con ese email" : error.message as string;
    }
    return {
      success: false,
      message: "An error has ocurred",
      errors: {
        errors: [errorMsg ? errorMsg : "An error has ocurred"]
      }
    }
  }
}

export async function editTeaInfo(prevState: TeaInfoActionResponse | null, formData: FormData): Promise<TeaInfoActionResponse> {
  try {
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
      imagesOrder: formData.getAll("images_order") as Array<string> || undefined,
      keptImages: formData.getAll("kept_images") as Array<string> || undefined,
      keptImagesOrder: formData.getAll("kept_images_order") as Array<string> || undefined,
      deleteImages: formData.getAll("delete_images") as Array<string> || undefined
    };
    const validatedFields = TeaInfoFormSchema.safeParse(rawData)
    
    if (!validatedFields.success) {
      const myErrors = z.treeifyError(validatedFields.error);
      console.log("Validation errors:");
      console.dir(myErrors, { depth: null });
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData
      }
    }

    const data = validatedFields.data;
    const day = data.dayNumber;
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
      url: data.urlStore
    }, day);
    if (!editedTea) {
      throw new Error("Cannot edit tea");
    }

    if (data.storyPart1 || data.storyPart2 || data.storyPart3 || data.youtubeURL || data.onlyMusic) {
      const editedStory = await editStoryTea({
        storyPart1: data.storyPart1,
        storyPart2: data.storyPart2,
        storyPart3: data.storyPart3,
        youtubeURL: data.youtubeURL,
        onlyMusic: data.onlyMusic
      }, day)
      if (!editedStory) {
        throw new Error("Cannot edit story tea");
      }
    }
    if (data.images && data.imagesOrder) {
      const publicIds = await Promise.all(data.images.map(async (image) => await uploadImageCloudinary(image, "teaDay") ));
      for (const [i, publicId] of publicIds.entries()){
        if (publicId) {
          await addStoryImage(publicId, data.imagesOrder[i], day)
        } 
      }
    }
    if (data.keptImages && data.keptImagesOrder) {
      const images = data.keptImages;
      const order = data.keptImagesOrder;
      await prisma.$transaction(async (tx) => {
        for (const [i, id] of images.entries()) {
          await tx.storyImage.update({ where: { id }, data: { order: -i-100 } });
        }
        for (const [i, id] of images.entries()) {
          await tx.storyImage.update({ where: { id }, data: { order: order[i] } });
        }
      });
    }

    if (data.deleteImages) {
      for (const id of data.deleteImages) {
        await deleteStoryImage(id);
      }
    }
    
    return {
      success: true,
      message: "Tea created successfully"
    }
  } catch (error) {
    console.error("Validation error:", error)
    let errorMsg = "";
    if (error && typeof(error) === "object" && "message" in error) {
      errorMsg = (error.message === "User already exists. Use another email.") ? "Ya existe un usuario con ese email" : error.message as string;
    }
    return {
      success: false,
      message: "An error has ocurred",
      errors: {
        errors: [errorMsg ? errorMsg : "An error has ocurred"]
      }
    }
  }
}

export async function assignUserToDay(dayId: string, userId: string, year: number = 2025) {
  try {
    if (!userId) {
      const assignment = await prisma.dayAssignment.delete({ where: { dayId }, include: { day: true, user: true } });
      console.log(`Assignment for day ${assignment.day.dayNumber}/${year} and user ${assignment.user.username} deleted`);
      return { success: true };
    }

    await prisma.dayAssignment.upsert({
      where: { userId_year: { userId, year } },
      create: { dayId, userId, year },
      update: { dayId, userId, year }
    });
    revalidatePath("/edit-tea-info");
    return { success: true };
  } catch (error) {
    console.log(error);
    return {
      success: false,
      error: `Error assigning user ${userId} to day ${dayId}`
    }
  }
}