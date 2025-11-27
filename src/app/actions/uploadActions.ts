"use server";

import { CloudarinaryFolder, uploadImage } from "@/lib/cloudinary";

export const uploadImageCloudinary = async (file: File, folder: CloudarinaryFolder ) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadImage(buffer, folder);
  return result?.public_id;
}