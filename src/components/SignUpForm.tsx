"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Form from "next/form";
import { FaUser } from "react-icons/fa";
import { GiBrainLeak } from "react-icons/gi";
import { IoKeySharp } from "react-icons/io5";
import { MdEmail } from "react-icons/md";
import Image from "next/image";
import { CgProfile } from "react-icons/cg";
import { authClient } from "@/lib/auth-client";
import { uploadImageCloudinary } from "@/app/actions/upload";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

export default function SignUpForm() {
  const [username, setUsername] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordConfirmation, setPasswordConfirmation] = useState<string>("");
  const [image, setImage] = useState<File | null>(null);
  const [imagePreviewURL, setImagePreviewURL] = useState<string>("");
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");

  useEffect(() => {
    return () => URL.revokeObjectURL(imagePreviewURL);
  }, [imagePreviewURL]);

  const onAddFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageErrorMsg("");
    if (event.target.files) {
      const imageFile = event.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        event.currentTarget.value = "";
        setImageErrorMsg("Tipo de fichero no permitido");
        return;
      }
      setImage(imageFile);
      setImagePreviewURL(URL.createObjectURL(imageFile));
    }
  };

  const onSubmit = async () => {
    let imageURL;
    if (image) {
      imageURL = await uploadImageCloudinary(image);
    }
    //! Handle upload error
    await authClient.signUp.email({
      email,
      password,
      name: username,
      username,
      image: imageURL,
      callbackURL: "/profile",
      fetchOptions: {
        onError: (ctx: unknown) => {
          console.log("Error", ctx)
        },
        onSuccess: () => {
          console.log("Registrado")
        }
      }
    } as unknown as Parameters<typeof authClient.signUp.email>[0])
  }
  return (
    <div className="card w-96 bg-base-100 shadow-xl mt-20 mb-20">
      <Form className="card-body" action={onSubmit}>
        <h2 className="card-title">Registro</h2>
        <div className="items-center mt-2">
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <FaUser />
            <input type="text" className="grow" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
          </label>
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input type="text" className="grow" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              type="password"
              className="grow"
              placeholder="Introduce tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              type="password"
              className="grow"
              placeholder="Confirma tu contraseña"
              value={passwordConfirmation}
              onChange={(e) => setPasswordConfirmation(e.target.value)}
            />
          </label>
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-full overflow-hidden flex items-center justify-center">
              {!image ? (
                <CgProfile size={96} className="text-neutral text-opacity-70" />
              ) : (
                <Image src={imagePreviewURL} alt="User profile preview" className="object-cover w-full h-full" width={96} height={96} />
              )}
            </div>
            <div className="flex-1 max-w-md">
              <div className="mb-2">
                <div className="text-sm opacity-80 mb-1">Seleccionar imagen</div>
                <div className="flex items-center gap-3">
                  <input
                    id="signup-profile-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => onAddFile(e)}
                    aria-label="Seleccionar imagen de perfil"
                  />
                  <label htmlFor="signup-profile-file" className="btn btn-sm btn-primary">
                    Seleccionar
                  </label>
                  <div className="text-xs opacity-70 max-w-26 truncate">{image?.name ?? "Ningún archivo"}</div>
                </div>
                {imageErrorMsg && <p className="text-xs text-error font-bold mt-1">{imageErrorMsg}</p>}
              </div>
            </div>
          </div>
        </div>
        <div className="card-actions justify-center">
          <button className="btn btn-primary w-full" type="submit">
            Registrarme
          </button>
        </div>
        <div className="flex gap-2 items-center justify-center">
          <GiBrainLeak />
          <Link href="/reset-password" className="link-neutral">
            {" "}
            He olvidado mi contraseña
          </Link>
        </div>
      </Form>
    </div>
  );
}
