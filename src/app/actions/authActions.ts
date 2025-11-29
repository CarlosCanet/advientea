"use server";
import { changeUserRole, createUser } from "@/lib/dal";
import { uploadImageCloudinary } from "./uploadActions";
import { auth } from "@/lib/auth";
import { SignInActionResponse, SignInFormData, SignUpActionResponse, SignUpFormData } from "@/lib/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFormFiles, getFormString } from "./commonActions";
import { Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

const SignupFormSchema = z
  .object({
    username: z.string().min(2, { error: "Name must be at least 2 characters long." }).trim(),
    email: z.string().email({ error: "Introduce un email correcto." }).trim(),
    password: z
      .string()
      .min(8, { error: "La contraseña debe ser de al menos 8 caracteres." })
      .regex(/[a-zA-Z]/, { error: "La contraseña debe contener al menos una letra." })
      .regex(/[0-9]/, { error: "La contraseña debe contener al menos un número." })
      .regex(/[^a-zA-Z0-9]/, {
        error: "Debe contener al menos un caracter especial.",
      })
      .trim(),
    passwordConfirmation: z.string(),
    image: z
      .file()
      .max(2 * 1024 * 1024, { error: "Tamaño de imagen demasiado grande (max 2 MB)." })
      .mime(["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"], {
        error: "Formato de archivo no permitido.",
      })
      .optional(),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["passwordConfirmation"],
  });

export async function signup(prevState: SignUpActionResponse | null, formData: FormData): Promise<SignUpActionResponse> {
  try {
    const rawData: SignUpFormData = {
      username: getFormString(formData, "username"),
      email: getFormString(formData, "email"),
      password: getFormString(formData, "password"),
      passwordConfirmation: getFormString(formData, "passwordConfirmation"),
      image: getFormFiles(formData, "image")[0],
    };
    const validatedFields = SignupFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
      };
    }
    const imgPublicId = validatedFields.data.image
      ? await uploadImageCloudinary(validatedFields.data.image, "avatars")
      : "advientea/2025-Caoslendario/avatars/kmz6ttle9ihjuosyqyns";

    const result = await createUser({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
      image: imgPublicId,
      username: validatedFields.data.username,
    });
    console.log("Validation success:", result);
  } catch (error) {
    console.error("Validation error:", error);
    let errorMsg = "";
    if (error && typeof error === "object" && "message" in error) {
      errorMsg = error.message === "User already exists. Use another email." ? "Ya existe un usuario con ese email" : (error.message as string);
    }
    return {
      success: false,
      message: "An error has ocurred",
      errors: {
        errors: [errorMsg ? errorMsg : "An error has ocurred"],
      },
    };
  }

  redirect("/");
}

export async function signin(prevState: SignInActionResponse | null, formData: FormData): Promise<SignInActionResponse> {
  try {
    const rawData: SignInFormData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };
    await auth.api.signInEmail({
      body: {
        email: rawData.email,
        password: rawData.password,
        callbackURL: "/profile",
      },
    });
  } catch (error) {
    console.error(error);
    return {
      success: false,
      message: "Usuario o contraseña incorrectos",
      errors: {
        password: ["Usuario o contraseña incorrectos"],
      },
    };
  }

  redirect("/");
}

export async function signout() {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/");
}

export async function changeRoleAction(id: string, role: Role) {
  try {
    await changeUserRole(id, role);
    revalidatePath("/users")
    return { success: true };
  } catch (error) {
    console.error(error);
    return {
      success: false,
      error: `Error changing role to user with id ${id}`,
    };
  }
}