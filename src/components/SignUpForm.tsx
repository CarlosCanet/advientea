"use client";

import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FaEye, FaEyeSlash, FaUser } from "react-icons/fa";
import { GiBrainLeak } from "react-icons/gi";
import { IoKeySharp } from "react-icons/io5";
import { MdEmail } from "react-icons/md";

import { signup } from "@/app/actions/authActions";
import { ALLOWED_IMAGE_TYPES, initialSignUpActionResponse } from "@/lib/types";

export default function SignUpForm() {
  const [state, action, isPending] = useActionState(signup, initialSignUpActionResponse);
  const [imagePreviewURL, setImagePreviewURL] = useState<string>("");
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  useEffect(() => {
    return () => {
      if (imagePreviewURL) {
        URL.revokeObjectURL(imagePreviewURL);
      }
    };
  }, [imagePreviewURL]);

  useEffect(() => {
    if (state.errors) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImagePreviewURL("");
      setPassword("");
      setPasswordConfirmation("");
      setShowPassword(false);
    }
  }, [state.errors]);
  console.log(state.success);
  const passwordError =
    password && passwordConfirmation && password !== passwordConfirmation ? "Las contraseñas no coinciden." : "";

  const onAddFile = (event: React.ChangeEvent<HTMLInputElement>) => {
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
    <div className="card w-full max-w-xl bg-base-100 shadow-xl mt-20 mb-20">
      <Form action={action} className="card-body">
        <h2 className="card-title">Registro</h2>
        <div className="items-center mt-2">
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <FaUser />
            <input
              className="grow"
              defaultValue={state?.inputs?.username}
              name="username"
              placeholder="Username"
              required
              type="text"
            />
          </label>
          {state?.errors?.properties?.username && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.username.errors.join(" ")}
            </p>
          )}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input
              autoComplete="username"
              className="grow"
              defaultValue={state?.inputs?.email}
              name="email"
              placeholder="Email"
              required
              type="email"
            />
          </label>
          {state?.errors?.properties?.email && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.email.errors.join(" ")}</p>
          )}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              autoComplete="new-password"
              className="grow"
              defaultValue={state?.inputs?.password}
              name="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introduce tu contraseña"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button className="cursor-pointer" onClick={() => setShowPassword(!showPassword)} type="button">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.password && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.password.errors.join(" ")}
            </p>
          )}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              autoComplete="new-password"
              className="grow"
              defaultValue={state?.inputs?.passwordConfirmation}
              name="passwordConfirmation"
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              placeholder="Confirma tu contraseña"
              required
              type={showPassword ? "text" : "password"}
              value={passwordConfirmation}
            />
          </label>
          {passwordError && <p className="text-xs text-error font-bold -mt-2 mb-2">{passwordError}</p>}
          {!passwordError && state.errors?.properties?.passwordConfirmation && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">
              {state.errors.properties.passwordConfirmation.errors.join(" ")}
            </p>
          )}

          <div className="flex items-center gap-4 mt-4">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center">
              {!imagePreviewURL ? (
                <Image
                  alt="User profile preview"
                  className="object-cover w-full h-full"
                  height={96}
                  src="/TeaLeavesImage.jpg"
                  width={96}
                />
              ) : (
                <Image
                  alt="User profile preview"
                  className="object-cover w-full h-full"
                  height={96}
                  src={imagePreviewURL}
                  width={96}
                />
              )}
            </div>
            <div className="flex-1 max-w-md">
              <div className="text-sm opacity-80 mb-1">Seleccionar imagen</div>
              <input
                aria-label="Seleccionar imagen de perfil"
                className="file-input file-input-bordered file-input-primary file-input-sm w-full max-w-xs"
                id="signup-profile-file"
                name="image"
                onChange={onAddFile}
                type="file"
              />
              {state?.errors?.properties?.image && (
                <p className="text-xs text-error font-bold mt-1">{state.errors.properties.image.errors.join(" ")}</p>
              )}
              {imageErrorMsg && <p className="text-xs text-error font-bold mt-1">{imageErrorMsg}</p>}
            </div>
          </div>
        </div>
        <div className="card-actions justify-center mt-4">
          <button className="btn btn-primary w-full" disabled={isPending || !!passwordError} type="submit">
            {isPending ? <span className="loading loading-spinner"></span> : "Registrarme"}
          </button>
        </div>
        {state?.success ? (
          <p className="text-sm text-success">{state.message}</p>
        ) : (
          <p className="text-sm text-error">{state.errors?.errors.join(" ")}</p>
        )}
        <div className="divider"></div>
        <div className="flex gap-2 items-center justify-center">
          <GiBrainLeak />
          <Link className="link-neutral" href="/reset-password">
            {" "}
            He olvidado mi contraseña
          </Link>
        </div>
      </Form>
    </div>
  );
}
