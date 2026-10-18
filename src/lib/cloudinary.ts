import "@/envConfig"
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary"
import { ALLOWED_IMAGE_TYPES } from "@/lib/types";

export const CloudinaryFolders = {
  AVATARS: "avatars",
  TEA_DAY: "teaDay"
}

export type CloudarinaryFolder = typeof CloudinaryFolders[keyof typeof CloudinaryFolders];

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Cloudinary format names derived from ALLOWED_IMAGE_TYPES.
 * Cloudinary names JPEG files "jpg"; every other type maps to its MIME subtype.
 */
const allowedFormats = ALLOWED_IMAGE_TYPES.map(format => {
  const f = format.toLowerCase().split("/")[1]
  if(f === "jpeg")
    return "jpg";
  return f;
});

/**
 * Uploads an image to Cloudinary.
 * Cloudinary rejects any file whose real format is not in `allowedFormats`.
 *
 * @param source - Local path, remote URL, or raw image bytes
 * @param mimeType - MIME type used to build the data URI when `source` is a Buffer
 * @param folder - Target subfolder (avatars or teaDay)
 * @returns The upload response, or undefined if the upload failed
 */
export const uploadImage = async (source: string | Buffer, mimeType: string, folder: CloudarinaryFolder): Promise<UploadApiResponse | undefined> => {
  const options: UploadApiOptions = {
    allowed_formats: allowedFormats,
    use_filename: true,
    unique_filename: false,
    overwrite: true,
    folder: `advientea/2025-Caoslendario/${folder}`
  }
  try {
    const uploadSource = Buffer.isBuffer(source) ? `data:${mimeType};base64,${source.toString('base64')}` : source;
    const result = await cloudinary.uploader.upload(uploadSource, options);
    return result;
  } catch (error) {
    console.error(error)
  }
}

/**
 * Uploads a browser `File` (e.g. from a form submission) to Cloudinary.
 *
 * @param file - The file received from the form
 * @param folder - Target subfolder (avatars or teaDay)
 * @returns The Cloudinary public id, or undefined if the upload failed
 */
export const uploadImageFile = async (file: File, folder: CloudarinaryFolder ) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await uploadImage(buffer, file.type, folder);
  return result?.public_id;
}

/**
 * Retrieves detailed information about an uploaded asset from Cloudinary
 * Useful for fetching metadata, transformation URLs, and asset properties
 * 
 * @param publicId - The unique public ID of the Cloudinary asset
 * @returns Promise resolving to the asset details including metadata, URLs, and properties
 *          Returns undefined if the asset is not found or request fails
 */
export const getAssetInfo = async (publicId: string): Promise<UploadApiResponse | undefined> => {
  try {
    const result = await cloudinary.api.resource((publicId))
    return result;
  } catch (error) {
    console.error(error)
  }
}

/**
 * Deletes an asset from Cloudinary storage
 * Use this to remove images when users delete content or clean up unused assets
 * 
 * @param publicId - The unique public ID of the Cloudinary asset to delete
 * @returns Promise resolving to the deletion response (includes result status)
 *          Returns undefined if the deletion fails
 */
export const deleteAsset = async (publicId: string): Promise<UploadApiResponse | undefined> => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image" })
    return result;
  } catch (error) {
    console.error(error)
  }
}
