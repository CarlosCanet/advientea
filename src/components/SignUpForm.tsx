"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import Form from "next/form";
import { FaEye, FaEyeSlash, FaUser } from "react-icons/fa";
import { GiBrainLeak } from "react-icons/gi";
import { IoKeySharp } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import Image from "next/image";
import { signup } from "@/app/actions/authActions";
import { initialSignUpActionResponse } from "@/lib/types";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

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
    password && passwordConfirmation && password !== passwordConfirmation
      ? "Las contraseñas no coinciden."
      : "";

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
    <div className="card w-96 bg-base-100 shadow-xl mt-20 mb-20">
      <Form className="card-body" action={action}>
        <h2 className="card-title">Registro</h2>
        <div className="items-center mt-2">
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <FaUser />
            <input type="text" name="username" className="grow" placeholder="Username" required defaultValue={state?.inputs?.username}/>
          </label>
          {state?.errors?.properties?.username && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.username.errors.join(" ")}</p>}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input type="email" name="email" className="grow" placeholder="Email" autoComplete="username" required defaultValue={state?.inputs?.email} />
          </label>
          {state?.errors?.properties?.email && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.email.errors.join(" ")}</p>}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              className="grow"
              placeholder="Introduce tu contraseña"
              value={password}
              autoComplete="new-password"
              onChange={(e) => setPassword(e.target.value)}
              defaultValue={state?.inputs?.password}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="cursor-pointer">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.properties?.password && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.password.errors.join(" ")}</p>}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              name="passwordConfirmation"
              type={showPassword ? "text" : "password"}
              className="grow"
              placeholder="Confirma tu contraseña"
              value={passwordConfirmation}
              autoComplete="new-password"
              onChange={(e) => setPasswordConfirmation(e.target.value)}
              defaultValue={state?.inputs?.passwordConfirmation}
              required
            />
          </label>
          {passwordError && <p className="text-xs text-error font-bold -mt-2 mb-2">{passwordError}</p>}
          {!passwordError && state.errors?.properties?.passwordConfirmation && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.passwordConfirmation.errors.join(" ")}</p>}

          <div className="flex items-center gap-4 mt-4">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center">
              {!imagePreviewURL ? (
                <Image src="/TeaLeavesImage.jpg" alt="User profile preview" className="object-cover w-full h-full" width={96} height={96} />
              ) : (
                <Image src={imagePreviewURL} alt="User profile preview" className="object-cover w-full h-full" width={96} height={96} />
              )}
            </div>
            <div className="flex-1 max-w-md">
              <div className="text-sm opacity-80 mb-1">Seleccionar imagen</div>
              <input id="signup-profile-file" name="image" type="file" className="file-input file-input-bordered file-input-primary file-input-sm w-full max-w-xs" onChange={onAddFile} aria-label="Seleccionar imagen de perfil" />
              {state?.errors?.properties?.image && <p className="text-xs text-error font-bold mt-1">{state.errors.properties.image.errors.join(" ")}</p>}
              {imageErrorMsg && <p className="text-xs text-error font-bold mt-1">{imageErrorMsg}</p>}
            </div>
          </div>
        </div>
        <div className="card-actions justify-center mt-4">
          <button className="btn btn-primary w-full" type="submit" disabled={isPending || !!passwordError}>
            {isPending ? <span className="loading loading-spinner"></span> : "Registrarme"}
          </button>
        </div>
        {state?.success ? <p className="text-sm text-success">{state.message}</p> : <p className="text-sm text-error">{state.errors?.errors.join(" ")}</p>}
        <div className="divider"></div>
        <div className="flex gap-2 items-center justify-center">
          <GiBrainLeak />
          <Link href="/reset-password" className="link-neutral"> He olvidado mi contraseña</Link>
        </div>
      </Form>
    </div>
  );
}
