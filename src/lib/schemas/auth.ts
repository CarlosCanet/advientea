import { z } from "zod";

import { toNormalizedPassword } from "@/lib/password";
import { ALLOWED_IMAGE_TYPES } from "@/lib/types";

// Any password field: the value is normalised before the checks, so they judge what will be hashed.
const passwordInputSchema = z.string().overwrite(toNormalizedPassword);

const passwordSchema = passwordInputSchema
  .min(8, { error: "La contraseña debe ser de al menos 8 caracteres." })
  .max(128, { error: "La contraseña no puede tener más de 128 caracteres." })
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

const emailSchema = z
  .string()
  .trim()
  .pipe(z.email({ error: "Introduce un email correcto." }));
// The profile form always sends both fields: "" means "keep current password" and must become undefined before
// validation.
const profileNewPasswordSchema = passwordInputSchema
  .transform((value) => (value === "" ? undefined : value))
  .pipe(passwordSchema.optional());
const profileNewPasswordConfirmationSchema = passwordInputSchema
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const signupFormSchema = commonSchema
  .extend({
    email: emailSchema,
    password: passwordSchema,
    passwordConfirmation: passwordInputSchema,
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export const updateProfileFormSchema = commonSchema
  .extend({
    currentPassword: passwordInputSchema.optional(),
    newPassword: profileNewPasswordSchema,
    newPasswordConfirmation: profileNewPasswordConfirmationSchema,
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["newPasswordConfirmation"],
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    error: "Introduce tu contraseña actual para cambiarla.",
    path: ["currentPassword"],
  });

export const requestPasswordResetFormSchema = z.object({
  email: emailSchema,
});

export const resetPasswordFormSchema = z
  .object({
    newPassword: passwordSchema,
    newPasswordConfirmation: passwordInputSchema,
    token: z.string().trim().min(1, { error: "El enlace no es válido. Pide uno nuevo." }),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["newPasswordConfirmation"],
  });
