import { z } from "zod";

import { EditionStatus } from "@/generated/prisma/enums";

export const editionFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Máximo 60 caracteres"),
  year: z
    .number()
    .int("El año debe ser un número entero")
    .min(2025, "El año mínimo es 2025")
    .max(2100, "El año máximo es 2100"),
});

export const editionStatusChangeSchema = z.object({
  status: z.enum(EditionStatus),
  year: z.number().int(),
});
