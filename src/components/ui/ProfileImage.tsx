"use client";

import { CldImage } from "next-cloudinary"

function ProfileImage({name, image}: {name: string, image: string} ) {
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden relative ">
      <CldImage src={image} alt={`Imagen de perfil de ${name}`} fill={true} className="object-cover"/>
    </div>
  )
}
export default ProfileImage