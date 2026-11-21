import { z } from "zod";

import { ALLOWED_IMAGE_TYPES } from "@/lib/types";

const teaFields = {
  addMilk: z.boolean(),
  canReinfuse: z.boolean(),
  hasTheine: z.boolean(),
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
  infusionTime: z.number().min(1, "Tiempo mínimo: 1 min").max(30, "Tiempo máximo: 30 min"),
  keptImages: z.array(z.string()).optional(),
  keptImagesOrder: z.array(z.coerce.number()).optional(),
  moreIndications: z.string().optional(),
  onlyMusic: z.boolean(),
  reinfuseNumber: z.number().min(0, "Mínimo 0 veces").optional(),
  storeName: z.string().optional(),
  storyPart1: z.string().optional(),
  storyPart2: z.string().optional(),
  storyPart3: z.string().optional(),
  teaName: z.string().trim().min(1, "El nombre del té es requerido"),
  temperature: z.number().min(30, "Temperatura mínima: 30°C").max(150, "Temperatura máxima: 150°C"),
  urlStore: z.url("URL inválida. Debe empezar por http:// o https://.").optional(),
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
};

function isReinfuseNumberConsistent(data: { canReinfuse: boolean; reinfuseNumber?: number }) {
  return !data.canReinfuse || (data.canReinfuse && data.reinfuseNumber && data.reinfuseNumber > 0);
}
const reinfuseNumberIssue = { error: "Si reinfusiona 0 veces, no reinfusiona.", path: ["reinfuseNumber"] };

/** The tea form of a participation that already exists: /my-tea, /invitado and the managers' editor. */
export const teaFormSchema = z.object(teaFields).refine(isReinfuseNumberConsistent, reinfuseNumberIssue);
