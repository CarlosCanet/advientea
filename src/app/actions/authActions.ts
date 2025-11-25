"use server";
import { uploadImageCloudinary } from "./uploadActions";
import { auth } from "@/lib/auth";
import { SignInActionResponse, SignInFormData, SignUpActionResponse, SignUpFormData } from "@/lib/definitions";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const SignupFormSchema = z.object({
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
      error: "Formato de archivo no permitido."
    }),
}).refine(data => data.password === data.passwordConfirmation, {
  error: "Las contraseñas no coinciden.",
  path: ["passwordConfirmation"],
});

export async function signup(prevState: SignUpActionResponse | null, formData: FormData): Promise<SignUpActionResponse> {
  try {
    const rawData: SignUpFormData = {
      username: formData.get("username") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
      passwordConfirmation: formData.get("passwordConfirmation") as string,
      image: formData.get("image") as File,
    }
    const validatedFields = SignupFormSchema.safeParse(rawData)

    if (!validatedFields.success) {
      return {
        success: false,
        message: "Hay errores en el formulario",
        errors: z.treeifyError(validatedFields.error),
        inputs: rawData
      }
    }
    const imgPublicId = await uploadImageCloudinary(validatedFields.data.image);
  
    const result = await auth.api.signUpEmail({
      body: {
        name: validatedFields.data.username,
        email: validatedFields.data.email,
        password: validatedFields.data.password,
        image: imgPublicId,
        username: validatedFields.data.username,
        callbackURL: "/profile"
      }
    })
    console.log("Validation success:", result)    
  } catch (error) {
    console.error("Validation error:", error)
    let errorMsg = "";
    if (error && typeof(error) === "object" && "message" in error) {
      errorMsg = (error.message === "User already exists. Use another email.") ? "Ya existe un usuario con ese email" : error.message as string;
    }
    return {
      success: false,
      message: "An error has ocurred",
      errors: {
        errors: [errorMsg ? errorMsg : "An error has ocurred"]
      }
    }
  }
  
  redirect("/profile");
}


export async function signin(prevState: SignInActionResponse | null, formData: FormData): Promise<SignInActionResponse> {
  try {
    const rawData: SignInFormData = {
      email: formData.get("email") as string,
      password: formData.get("password") as string
    }
    await auth.api.signInEmail({
      body: {
        email: rawData.email,
        password: rawData.password,
        callbackURL: "/profile"
      }
    })
  } catch (error) {
    console.error(error)
    return {
      success: false,
      message: "Usuario o contraseña incorrectos",
      errors: {
        password: ["Usuario o contraseña incorrectos"],
      }
    }
  }
  
  redirect("/profile");
}

export async function signout() {
  await auth.api.signOut({
    headers: await headers(),
  });
  redirect("/");
}