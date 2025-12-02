"use client";
import { updateUserProfile } from "@/app/actions/authActions";
import { ALLOWED_IMAGE_TYPES, initialUpdateProfileActionResponse } from "@/lib/types";
import { CldImage } from "next-cloudinary";
import Form from "next/form";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { FaEye, FaEyeSlash, FaUser } from "react-icons/fa";
import { IoKeySharp } from "react-icons/io5";
import { MdOutlinePassword } from "react-icons/md";

interface ProfileFormProps {
  username: string;
  email: string;
  imageId: string;
}

export default function ProfileForm({ username, email, imageId }: ProfileFormProps) {
  const [state, action, isPending] = useActionState(updateUserProfile, initialUpdateProfileActionResponse);
  const [isChangingPassword, setIsChangingPassword] = useState<boolean>(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [imagePreviewURL, setImagePreviewURL] = useState<string>("");
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const router = useRouter();

  const passwordError = newPassword && newPasswordConfirmation && newPassword !== newPasswordConfirmation ? "Las contraseñas no coinciden." : "";
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
            <Image src={imagePreviewURL} alt="User profile preview" className="object-cover w-full h-full" width={1200} height={1200} />
          ): (
            <CldImage src={imageId} alt="User profile preview" className="object-cover w-full h-full" width={1200} height={1200} />
          )}
        </div>
        <input
          type="file"
          name="image"
          className="file-input file-input-primary place-self-center file-input-sm"
          onChange={handleChange}
          aria-label="Seleccionar imagen"
        />
        {imageErrorMsg && <p className="text-xs text-error font-bold -mt-3">{imageErrorMsg}</p>}
      </div>
      <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
        <span className="floating-label">Username</span>
        <FaUser />
        <input type="text" name="username" className="grow" placeholder="Username" autoComplete="additional-name" required defaultValue={state.inputs?.username ?? username} />
      </label>
      {state?.errors?.properties?.username && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.username.errors.join(" ")}</p>}
      <div className="divider my-0"></div>
      <label className="label w-full place-content-evenly">
        <input type="checkbox" checked={isChangingPassword} className="checkbox checkbox-sm" onChange={() => setIsChangingPassword((prevState) => !prevState)} />
        ¿Cambiar contraseña?
      </label>

      {isChangingPassword && (
        <>
          <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label">Contraseña actual</span>
            <IoKeySharp />
            <input
              name="currentPassword"
              type={showCurrentPassword ? "text" : "password"}
              className="grow"
              placeholder="Contraseña actual"
              defaultValue={state?.inputs?.currentPassword}
              required
            />
            <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="cursor-pointer">
              {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.currentPassword && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.currentPassword.errors.join(" ")}</p>}
          <label className="input input-primary floating-label flex items-center gap-2 w-full">
            <span className="floating-label">Nueva contraseña</span>
            <MdOutlinePassword />
            <input
              name="newPassword"
              type={showNewPassword ? "text" : "password"}
              className="grow"
              placeholder="Nueva contraseña"
              value={state?.inputs?.newPassword ?? newPassword}
              autoComplete="new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="cursor-pointer">
              {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.newPassword && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.newPassword.errors.join(" ")}</p>}

          <label className="input input-primary floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label">Confirma tu nueva contraseña</span>
            <MdOutlinePassword />
            <input
              name="newPasswordConfirmation"
              type={showNewPassword ? "text" : "password"}
              className="grow"
              placeholder="Confirma tu nueva contraseña"
              value={state?.inputs?.newPasswordConfirmation ?? newPasswordConfirmation}
              autoComplete="new-password"
              onChange={(e) => setNewPasswordConfirmation(e.target.value)}
              required
            />
          </label>
          {passwordError && <p className="text-xs text-error font-bold -mt-2 mb-2">{passwordError}</p>}
          {!passwordError && state.errors?.properties?.newPasswordConfirmation && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.newPasswordConfirmation.errors.join(" ")}</p>
          )}
        </>
      )}
      <div className="card-actions justify-center mt-4">
        <button className="btn btn-soft btn-neutral" type="button" onClick={() => router.back()}>Atrás</button>
        <button className="btn btn-primary" type="submit" disabled={isPending || !!passwordError}>
          {isPending ? <span className="loading loading-spinner"></span> : "Editar"}
        </button>
      </div>
    </Form>
  );
}
