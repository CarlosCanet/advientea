"use client";

import { getCldImageUrl } from "next-cloudinary";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

// Twice the largest rendered size, so the avatar stays sharp on dense screens.
const AVATAR_PIXELS = 96;

function toInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase("es");
}

function ProfileImage({ className, image, name }: { className?: string; image: string; name: string }) {
  const src = getCldImageUrl({
    crop: "fill",
    gravity: "auto",
    height: AVATAR_PIXELS,
    src: image,
    width: AVATAR_PIXELS,
  });

  return (
    <Avatar className={cn("size-12", className)}>
      <AvatarImage alt={`Imagen de perfil de ${name}`} src={src} />
      <AvatarFallback className="font-medium">{toInitials(name)}</AvatarFallback>
    </Avatar>
  );
}
export default ProfileImage;
