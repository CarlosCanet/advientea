import "@/envConfig";
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary";

import { ALLOWED_IMAGE_TYPES, DEFAULT_IMAGE_PROFILE } from "@/lib/types";

export type AssetFolder = { kind: "avatars" } | { kind: "teaDay"; year: number };

cloudinary.config({
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
});

export function assetRoot() {
  if (process.env.VERCEL_ENV === "production") {
    return "advientea";
  }
  if (process.env.VERCEL_ENV === "preview") {
    return "advientea-staging";
  }
  return "advientea-local";
}

export function assetFolder(folder: AssetFolder) {
  const root = assetRoot();
  if (folder.kind === "teaDay") {
    return `${root}/${folder.year}/teaDay`;
  }
  return `${root}/avatars`;
}

/** ALLOWED_IMAGE_TYPES as Cloudinary spells them: JPEG is "jpg", every other type is its MIME subtype. */
const allowedFormats = ALLOWED_IMAGE_TYPES.map((format) => {
  const f = format.toLowerCase().split("/")[1];
  if (f === "jpeg") return "jpg";
  return f;
});

/** The public id of the uploaded image, or undefined when Cloudinary rejected it (the real format is checked there). */
export async function uploadImage(file: File, folder: AssetFolder): Promise<string | undefined> {
  const path = assetFolder(folder);
  // Dynamic folder mode: asset_folder places the asset in the console, public_id_prefix puts the same path in the
  // public id, which is what the database stores and deleteAsset checks. Neither key is in the SDK typings.
  const options: UploadApiOptions = {
    allowed_formats: allowedFormats,
    asset_folder: path,
    overwrite: false,
    public_id_prefix: path,
  };
  try {
    const bufferBase64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const uploadSource = `data:${file.type};base64,${bufferBase64}`;
    const result = await cloudinary.uploader.upload(uploadSource, options);
    return result.public_id;
  } catch (error) {
    console.error(error);
  }
}

/** Cloudinary's answer to the deletion, or undefined when the call failed or the asset is not this environment's. */
export async function deleteAsset(publicId: string): Promise<undefined | UploadApiResponse> {
  // The trailing slash matters: "advientea" is a plain prefix of "advientea-staging".
  const root = `${assetRoot()}/`;
  if (!publicId.startsWith(root)) {
    console.error(`[deleteAsset] refused ${publicId}: outside ${root}`);
    return undefined;
  }
  // Every user without an avatar renders this one; a profile row that stored it must not take it away.
  if (publicId === DEFAULT_IMAGE_PROFILE) {
    console.error(`[deleteAsset] refused ${publicId}: shared default avatar`);
    return undefined;
  }
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    return result;
  } catch (error) {
    console.error(error);
  }
}
