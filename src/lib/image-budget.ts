/** What one story image may weigh: the same limit as the images in `src/lib/schemas/tea.ts`. */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

/** What the images added in one save may weigh together; the ones already saved do not count. */
export const MAX_NEW_IMAGES_BYTES = 2.5 * 1024 * 1024;

const BYTES_PER_MEGABYTE = 1024 * 1024;

// Absorbs the floating-point error of sizes such as 1.1 MiB; a real excess is at least one byte, far above it.
const ROUNDING_TOLERANCE = 1e-9;

const megabytes = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

export function getNewImagesBytes(images: ReadonlyArray<{ file?: null | { size: number }; isNew: boolean }>): number {
  return images.reduce((total, image) => (image.isNew ? total + (image.file?.size ?? 0) : total), 0);
}

export function isImageTooLarge(bytes: number): boolean {
  return bytes > MAX_IMAGE_BYTES;
}

export function isOverNewImagesBudget(bytes: number): boolean {
  return bytes > MAX_NEW_IMAGES_BYTES;
}

/** Rounded up to a tenth, so a total just over a limit never reads as equal to it. */
export function toMegabytesLabel(bytes: number): string {
  const tenths = Math.ceil((bytes / BYTES_PER_MEGABYTE) * 10 - ROUNDING_TOLERANCE);
  return megabytes.format(Math.max(tenths, 0) / 10);
}
