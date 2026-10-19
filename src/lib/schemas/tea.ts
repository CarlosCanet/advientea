import { z } from "zod";
import { ALLOWED_IMAGE_TYPES } from "@/lib/types";

export const teaInfoFormSchema = z
  .object({
    personName: z.string().trim().min(1, "El nombre es requerido"),
    dayNumber: z.number().min(0, "Día mínimo: 0"),
    teaName: z.string().trim().min(1, "El nombre del té es requerido"),
    temperature: z.number().min(30, "Temperatura mínima: 30°C").max(150, "Temperatura máxima: 150°C"),
    infusionTime: z.number().min(1, "Tiempo mínimo: 1 min").max(30, "Tiempo máximo: 30 min"),
    hasTheine: z.boolean(),
    addMilk: z.boolean(),
    canReinfuse: z.boolean(),
    reinfuseNumber: z.number().min(0, "Mínimo 0 veces").optional(),
    moreIndications: z.string().optional(),
    storeName: z.string().optional(),
    urlStore: z.url("URL inválida. Debe empezar por http:// o https://.").optional(),
    storyPart1: z.string().optional(),
    storyPart2: z.string().optional(),
    storyPart3: z.string().optional(),
    youtubeURL: z
      .url("Debe ser una URL válida que empiece por http:// o https://.")
      .refine((url) => {
        try {
          const { hostname } = new URL(url);
          const cleanHostname = hostname.replace(/^www\./, "");
          return cleanHostname.startsWith("youtube.com") || cleanHostname.startsWith("youtu.be");
        } catch {
          return false;
        }
      }, "Sólo URL de youtube.com o youtu.be")
      .optional(),
    onlyMusic: z.boolean(),
    images: z
      .array(
        z
          .file()
          .max(2 * 1024 * 1024, {
            error: "Tamaño de imagen demasiado grande (max 2 MB).",
          })
          .mime(ALLOWED_IMAGE_TYPES, {
            error: "Formato de archivo no permitido.",
          }),
      )
      .optional(),
    imagesOrder: z.array(z.coerce.number()).optional(),
    keptImages: z.array(z.string()).optional(),
    keptImagesOrder: z.array(z.coerce.number()).optional(),
    teaId: z.string().optional(),
  })
  .refine((data) => !data.canReinfuse || (data.canReinfuse && data.reinfuseNumber && data.reinfuseNumber > 0), {
    error: "Si reinfusiona 0 veces, no reinfusiona.",
    path: ["reinfuseNumber"],
  });
