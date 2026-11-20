import { z } from "zod";

import { EditionStatus } from "@/generated/prisma/enums";

export const EDITION_YEAR_MIN = 2024;
export const EDITION_YEAR_MAX = 2100;

const editionYearSchema = z
  .number()
  .int("El año debe ser un número entero")
  .min(EDITION_YEAR_MIN, `El año mínimo es ${EDITION_YEAR_MIN}`)
  .max(EDITION_YEAR_MAX, `El año máximo es ${EDITION_YEAR_MAX}`);

/** The year in a URL segment: four plain digits within the range, so "0x7EA", "2e3" or "2026.0" are no edition. */
export function toEditionYear(segment: string): null | number {
  if (!/^\d{4}$/.test(segment)) {
    return null;
  }
  const parsed = editionYearSchema.safeParse(Number(segment));
  return parsed.success ? parsed.data : null;
}

export const editionFormSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Máximo 60 caracteres"),
  year: editionYearSchema,
});

export const editionStatusChangeSchema = z.object({
  status: z.enum(EditionStatus),
  year: z.number().int(),
});

export const enrolUserSchema = z.object({
  userId: z.string().min(1),
  year: editionYearSchema,
});

export const enrolGuestSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio").max(60, "Máximo 60 caracteres"),
  year: editionYearSchema,
});

export const placeParticipantSchema = z.object({
  // null takes the participant off their day.
  dayNumber: z.number().int().min(1).nullable(),
  participationId: z.string().min(1),
});

export const swapParticipantsSchema = z
  .object({
    firstParticipationId: z.string().min(1),
    secondParticipationId: z.string().min(1),
  })
  .refine((ids) => ids.firstParticipationId !== ids.secondParticipationId);

export const deleteDaySchema = z.object({
  dayId: z.string().min(1),
});

export const unenrolParticipantSchema = z.object({
  deleteTea: z.boolean(),
  participationId: z.string().min(1),
});
