"use client";

import { CldImage } from "next-cloudinary";

function ProfileImage({ image, name }: { image: string; name: string }) {
  return (
    <div className="w-12 h-12 rounded-full overflow-hidden relative ">
      <CldImage alt={`Imagen de perfil de ${name}`} className="object-cover" fill={true} src={image} />
    </div>
  );
}
export default ProfileImage;
