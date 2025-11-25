"use server";

import { uploadImage } from "@/lib/cloudinary";

export const uploadImageCloudinary = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadImage(buffer, "avatars");
  return result?.public_id;
}