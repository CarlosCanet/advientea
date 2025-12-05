"use server";
import { uploadImageCloudinary } from "./uploadActions";
import { auth } from "@/lib/auth";
import { SignInActionResponse, SignInFormData, SignUpActionResponse, SignUpFormData, UpdateProfileActionResponse, UpdateProfileFormData } from "@/lib/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFormFiles, getFormString } from "./commonActions";
import { Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { deleteAsset } from "@/lib/cloudinary";
import { createUser } from "@/lib/services/user-service";
import { changeUserRole } from "@/lib/dal/dal-user";

const SignupFormSchema = z
  .object({
    username: z.string().min(2, { error: "Name must be at least 2 characters long." }).trim(),
    email: z.email({ error: "Introduce un email correcto." }).trim(),
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
      : null;

    const result = await createUser({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
      username: validatedFields.data.username,
      ...(imgPublicId ? {image : imgPublicId} : {}),
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

const updateProfileFormSchema = z
  .object({
    username: z.string().min(2, { error: "Name must be at least 2 characters long." }).trim(),
    // email: z.email({ error: "Introduce un email correcto." }).trim(),
    currentPassword: z.string().optional(),
    newPassword: z
      .string()
      .trim()
      .transform((value) => (value === "" ? undefined : value))
      .pipe(
        z.string()
        .min(8, { error: "La contraseña debe ser de al menos 8 caracteres." })
        .regex(/[a-zA-Z]/, { error: "La contraseña debe contener al menos una letra." })
        .regex(/[0-9]/, { error: "La contraseña debe contener al menos un número." })
        .regex(/[^a-zA-Z0-9]/, {
          error: "Debe contener al menos un caracter especial.",
        }).optional()
    ),      
    newPasswordConfirmation: z
      .string()
      .transform((value) => (value === "" ? undefined : value))
      .optional(),
    image: z
      .file()
      .max(2 * 1024 * 1024, { error: "Tamaño de imagen demasiado grande (max 2 MB)." })
      .mime(["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"], {
        error: "Formato de archivo no permitido.",
      })
      .optional(),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    error: "Las contraseñas no coinciden.",
    path: ["newPasswordConfirmation"],
  });

export async function updateUserProfile(prevState: UpdateProfileActionResponse | null, formData: FormData): Promise<UpdateProfileActionResponse> {
  let newImageId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session || !session.user) {
      return { success: false, message: "User is not login" };
    }

    const user = session.user;
    const currentImageId: string | null = user.image ?? null;
    let shouldLogout: boolean = false;
    
    const rawData: UpdateProfileFormData = {
      username: getFormString(formData, "username"),
      // email: getFormString(formData, "email"),
      currentPassword: getFormString(formData, "currentPassword"),
      newPassword: getFormString(formData, "newPassword"),
      newPasswordConfirmation: getFormString(formData, "newPasswordConfirmation"),
      image: getFormFiles(formData, "image")[0],
    };
    const validatedFields = updateProfileFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
      };
    }

    if (validatedFields.data.currentPassword && validatedFields.data.newPassword) {
      await auth.api.changePassword({
        body: {
            newPassword: validatedFields.data.newPassword,
            currentPassword: validatedFields.data.currentPassword,
            revokeOtherSessions: true,
        },
        headers: await headers(),
      });
      shouldLogout = true;
    }
    
    if (validatedFields.data.image) {
      const result = await uploadImageCloudinary(validatedFields.data.image, "avatars");
      if (result) {
        newImageId = result;
        if (currentImageId) {
          await deleteAsset(currentImageId);
        }
      }
    }
    
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        username: validatedFields.data.username,
        ...(newImageId ? { image: newImageId } : {})
      }
    })
    revalidatePath("/profile");
    if (shouldLogout) {
      await signout()
    }
    return { success: true, message: "Profile updated" };
  } catch (error) {
    console.error("Validation error:", error);
    if (newImageId) {
      await deleteAsset(newImageId);
    }
    return {
      success: false,
      message: "An error has ocurred",
    };
  }

}