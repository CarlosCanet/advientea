"use client";

import { CldImage } from "next-cloudinary"

function ProfileImage({name, image}: {name: string, image: string} ) {
  return (
    <CldImage src={image} alt={`Imagen de perfil de ${name}`} fill={true} />
  )
}
export default ProfileImage