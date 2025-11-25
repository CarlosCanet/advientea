import "@/envConfig"
import { v2 as cloudinary, UploadApiOptions, UploadApiResponse } from "cloudinary"

export const CloudinaryFolders = {
  AVATARS: "avatars",
  TEA_DAY: "teaDay"
}

export type CloudarinaryFolder = typeof CloudinaryFolders[keyof typeof CloudinaryFolders];

cloudinary.config({
  // secure: true,
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Log the configuration
// console.log(cloudinary.config());


/**
 * Uploads an image file to Cloudinary
 * Images are stored in a year-specific calendar folder structure
 * 
 * @param source - Path to the local image file or remote URL to upload or buffer
 * @param folder - The target folder where the image should be stored (avatars or teaDay)
 * @returns Promise resolving to the Cloudinary upload response with image details (URL, publicId, etc.)
 *          Returns undefined if the upload fails
 * ```
 */
export const uploadImage = async (source: string | Buffer, folder: CloudarinaryFolder): Promise<UploadApiResponse | undefined> => {
  const options: UploadApiOptions = {
    use_filename: true,
    unique_filename: false,
    overwrite: true,
    folder: `advientea/2025-Caoslendario/${folder}`
  }
  try {
    const uploadSource = Buffer.isBuffer(source) ? `data:image/png;base64,${source.toString('base64')}` : source;
    const result = await cloudinary.uploader.upload(uploadSource, options);
    return result;
  } catch (error) {
    console.error(error)
  }
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
    const result = cloudinary.uploader.destroy(publicId, { resource_type: "image" })
    return result;
  } catch (error) {
    console.error(error)
  }
}