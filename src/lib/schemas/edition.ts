import { z } from "zod";

import { EditionStatus } from "@/generated/prisma/enums";

export const EDITION_YEAR_MIN = 2024;
export const EDITION_YEAR_MAX = 2100;

export const editionFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Máximo 60 caracteres"),
  year: z
    .number()
    .int("El año debe ser un número entero")
    .min(EDITION_YEAR_MIN, `El año mínimo es ${EDITION_YEAR_MIN}`)
    .max(EDITION_YEAR_MAX, `El año máximo es ${EDITION_YEAR_MAX}`),
});

export const editionStatusChangeSchema = z.object({
  status: z.enum(EditionStatus),
  year: z.number().int(),
});
