"use server";
import { uploadImageCloudinary } from "./uploadActions";
import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import {
  ActionResponse,
  SignInActionResponse,
  SignInFormData,
  SignUpActionResponse,
  SignUpFormData,
  UpdateProfileActionResponse,
  UpdateProfileFormData,
} from "@/lib/types";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getFormFiles, getFormString } from "./commonActions";
import { Role } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";
import { deleteAsset } from "@/lib/cloudinary";
import { createUser } from "@/lib/services/user-service";
import { changeUserRole, editUser, requireRole, requireSession } from "@/lib/dal";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { signupFormSchema, updateProfileFormSchema } from "@/lib/schemas/auth";

export async function signup(prevState: SignUpActionResponse | null, formData: FormData): Promise<SignUpActionResponse> {
  try {
    const rawData: SignUpFormData = {
      username: getFormString(formData, "username"),
      email: getFormString(formData, "email"),
      password: getFormString(formData, "password"),
      passwordConfirmation: getFormString(formData, "passwordConfirmation"),
      image: getFormFiles(formData, "image")[0],
    };
    const validatedFields = signupFormSchema.safeParse(rawData);

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData,
      };
    }
    const imgPublicId = validatedFields.data.image ? await uploadImageCloudinary(validatedFields.data.image, "avatars") : null;

    await createUser({
      email: validatedFields.data.email,
      password: validatedFields.data.password,
      username: validatedFields.data.username,
      ...(imgPublicId ? { image: imgPublicId } : {}),
    });
  } catch (error) {
    // Match the stable error code, not the message; startsWith covers both USER_ALREADY_EXISTS variants.
    const isDuplicateUser = error instanceof APIError && typeof error.body?.code === "string" && error.body.code.startsWith("USER_ALREADY_EXISTS");
    if (isDuplicateUser) {
      console.warn("[signup] rejected: email already registered");
    } else {
      console.error("[signup] unexpected error", error);
    }
    const message = isDuplicateUser ? "Ya existe una cuenta con ese email" : "No se pudo crear la cuenta. Inténtalo de nuevo.";
    return {
      success: false,
      message,
      errors: { errors: [message] },
    };
  }

  redirect("/");
}

export async function signin(prevState: SignInActionResponse | null, formData: FormData): Promise<SignInActionResponse> {
  try {
    const rawData: SignInFormData = {
      email: getFormString(formData, "email"),
      password: getFormString(formData, "password"),
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

export async function changeRoleAction(id: string, role: Role): Promise<ActionResponse> {
  try {
    const session = await requireRole(Role.ADMIN);
    if (!Object.values(Role).includes(role)) {
      throw new ForbiddenError("Rol no válido");
    }
    // An admin cannot change their own role: the last admin would lock themselves out.
    if (session.userId === id) {
      throw new ForbiddenError("No puedes cambiar tu propio rol");
    }
    await changeUserRole(id, role);
    revalidatePath("/users");
    return { success: true, message: "Rol actualizado" };
  } catch (error: unknown) {
    const isGuardError = error instanceof UnauthenticatedError || error instanceof ForbiddenError;
    if (isGuardError) {
      console.warn(`[changeRoleAction] rejected: ${error.name} — target=${id} role=${role} — ${error.message}`);
    } else {
      console.error("[changeRoleAction] unexpected error", error);
    }
    return {
      success: false,
      message: isGuardError ? error.message : "No se pudo cambiar el rol. Inténtalo de nuevo.",
    };
  }
}

export async function updateUserProfile(prevState: UpdateProfileActionResponse | null, formData: FormData): Promise<UpdateProfileActionResponse> {
  let newImageId: string | null = null;
  try {
    const session = await requireSession();

    const user = session.user;
    const currentImageId: string | null = user.image ?? null;

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
    await editUser(session.userId, {
      username: validatedFields.data.username,
      ...(newImageId ? { image: newImageId } : {}),
    });
    revalidatePath("/profile");
    return { success: true, message: "Perfil actualizado" };
  } catch (error) {
    console.error("[updateUserProfile] unexpected error", error);
    if (newImageId) {
      await deleteAsset(newImageId);
    }
    return {
      success: false,
      message: "No se pudo actualizar el perfil. Inténtalo de nuevo.",
    };
  }
}
