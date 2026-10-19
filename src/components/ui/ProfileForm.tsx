"use client";
import { CldImage } from "next-cloudinary";
import Form from "next/form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { FaEye, FaEyeSlash, FaUser } from "react-icons/fa";
import { IoKeySharp } from "react-icons/io5";
import { MdOutlinePassword } from "react-icons/md";

import { updateUserProfile } from "@/app/actions/authActions";
import { ALLOWED_IMAGE_TYPES, initialUpdateProfileActionResponse } from "@/lib/types";

interface ProfileFormProps {
  email: string;
  imageId: string;
  username: string;
}

export default function ProfileForm({ email, imageId, username }: ProfileFormProps) {
  const [state, action, isPending] = useActionState(updateUserProfile, initialUpdateProfileActionResponse);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [imagePreviewURL, setImagePreviewURL] = useState<string>("");
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const router = useRouter();

  const passwordError =
    newPassword && newPasswordConfirmation && newPassword !== newPasswordConfirmation
      ? "Las contraseñas no coinciden."
      : "";
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageErrorMsg("");
    if (event.target.files && event.target.files.length > 0) {
      const imageFile = event.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        event.currentTarget.value = "";
        setImageErrorMsg("Tipo de fichero no permitido");
        return;
      }
      setImagePreviewURL(URL.createObjectURL(imageFile));
    }
  };

  return (
    <Form action={action} className="flex flex-col gap-4 justify-center items-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-48 rounded-full border-4 border-primary overflow-hidden relative">
          {imagePreviewURL ? (
            <Image
              alt="User profile preview"
              className="object-cover w-full h-full"
              height={1200}
              src={imagePreviewURL}
              width={1200}
            />
          ) : (
            <CldImage
              alt="User profile preview"
              className="object-cover w-full h-full"
              height={1200}
              src={imageId}
              width={1200}
            />
          )}
        </div>
        <input
          aria-label="Seleccionar imagen"
          className="file-input file-input-primary place-self-center file-input-sm"
          name="image"
          onChange={handleChange}
          type="file"
        />
        {imageErrorMsg && <p className="text-xs text-error font-bold -mt-3">{imageErrorMsg}</p>}
      </div>
      <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
        <span className="floating-label">Username</span>
        <FaUser />
        <input
          autoComplete="additional-name"
          className="grow"
          defaultValue={state.inputs?.username ?? username}
          name="username"
          placeholder="Username"
          required
          type="text"
        />
      </label>
      {state?.errors?.properties?.username && (
        <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.username.errors.join(" ")}</p>
      )}
      <div className="divider my-0"></div>
      <label className="label w-full place-content-evenly">
        <input
          checked={isChangingPassword}
          className="checkbox checkbox-sm"
          onChange={() => setIsChangingPassword((prevState) => !prevState)}
          type="checkbox"
        />
        ¿Cambiar contraseña?
      </label>

      {isChangingPassword && (
        <>
          <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label">Contraseña actual</span>
            <IoKeySharp />
            <input
              className="grow"
              defaultValue={state?.inputs?.currentPassword}
              name="currentPassword"
              placeholder="Contraseña actual"
              required
              type={showCurrentPassword ? "text" : "password"}
            />
            <button
              className="cursor-pointer"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              type="button"
            >
              {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.currentPassword && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.currentPassword.errors.join(" ")}
            </p>
          )}
          <label className="input input-primary floating-label flex items-center gap-2 w-full">
            <span className="floating-label">Nueva contraseña</span>
            <MdOutlinePassword />
            <input
              autoComplete="new-password"
              className="grow"
              name="newPassword"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
              type={showNewPassword ? "text" : "password"}
              value={state?.inputs?.newPassword ?? newPassword}
            />
            <button className="cursor-pointer" onClick={() => setShowNewPassword(!showNewPassword)} type="button">
              {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.newPassword && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.newPassword.errors.join(" ")}
            </p>
          )}

          <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label">Confirma tu nueva contraseña</span>
            <MdOutlinePassword />
            <input
              autoComplete="new-password"
              className="grow"
              name="newPasswordConfirmation"
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
              placeholder="Confirma tu nueva contraseña"
              required
              type={showNewPassword ? "text" : "password"}
              value={state?.inputs?.newPasswordConfirmation ?? newPasswordConfirmation}
            />
          </label>
          {passwordError && <p className="text-xs text-error font-bold -mt-2 mb-2">{passwordError}</p>}
          {!passwordError && state.errors?.properties?.newPasswordConfirmation && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.newPasswordConfirmation.errors.join(" ")}
            </p>
          )}
        </>
      )}
      {state.message && (
        <p className={`text-sm text-center ${state.success ? "text-success" : "text-error"}`}>{state.message}</p>
      )}
      <div className="card-actions justify-center mt-4">
        <button className="btn btn-soft btn-neutral" onClick={() => router.back()} type="button">
          Atrás
        </button>
        <button className="btn btn-primary" disabled={isPending || !!passwordError} type="submit">
          {isPending ? <span className="loading loading-spinner"></span> : "Editar"}
        </button>
      </div>
    </Form>
  );
}
