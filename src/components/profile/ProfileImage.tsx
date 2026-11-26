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

interface ProfileImageProps {
  className?: string;
  image: string;
  /** True where the name is already shown next to the avatar, so screen readers do not hear it twice. */
  isDecorative?: boolean;
  name: string;
}

function ProfileImage({ className, image, isDecorative = false, name }: ProfileImageProps) {
  const src = getCldImageUrl({
    crop: "fill",
    gravity: "auto",
    height: AVATAR_PIXELS,
    src: image,
    width: AVATAR_PIXELS,
  });

  return (
    <Avatar className={cn("size-12", className)}>
      <AvatarImage alt={isDecorative ? "" : `Imagen de perfil de ${name}`} src={src} />
      <AvatarFallback aria-hidden={isDecorative || undefined} className="font-medium">
        {toInitials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
export default ProfileImage;
