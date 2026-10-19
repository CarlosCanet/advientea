import { z } from "zod";

import { ALLOWED_IMAGE_TYPES } from "@/lib/types";

const passwordSchema = z
  .string()
  .trim()
  .min(8, { error: "La contraseña debe ser de al menos 8 caracteres." })
  .regex(/[a-zA-Z]/, {
    error: "La contraseña debe contener al menos una letra.",
  })
  .regex(/[0-9]/, {
    error: "La contraseña debe contener al menos un número.",
  })
  .regex(/[^a-zA-Z0-9]/, {
    error: "Debe contener al menos un caracter especial.",
  });

const commonSchema = z.object({
  image: z
    .file()
    .max(2 * 1024 * 1024, {
      error: "Tamaño de imagen demasiado grande (max 2 MB).",
    })
    .mime(ALLOWED_IMAGE_TYPES, { error: "Formato de archivo no permitido." })
    .optional(),
  username: z.string().trim().min(2, { error: "Introduce un nombre de al menos 2 caracteres." }),
});

export const signupFormSchema = commonSchema
  .extend({
    email: z
      .string()
      .trim()
      .pipe(z.email({ error: "Introduce un email correcto." })),
    password: passwordSchema,
    passwordConfirmation: z.string().trim(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export const updateProfileFormSchema = commonSchema
  .extend({
    currentPassword: z.string().optional(),
    // The form always sends this field: "" means "keep current password" and must become undefined before validation.
    newPassword: z
      .string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .pipe(passwordSchema.optional()),
    newPasswordConfirmation: z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["newPasswordConfirmation"],
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    error: "Introduce tu contraseña actual para cambiarla.",
    path: ["currentPassword"],
  });
