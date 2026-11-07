import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { assetFolder, deleteAsset, uploadImage } from "@/lib/cloudinary";
import { DEFAULT_IMAGE_PROFILE } from "@/lib/types";

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: {
      destroy: vi.fn(),
      upload: vi.fn(),
    },
  },
}));

describe("Cloudinary integration", () => {
  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cloudinary.uploader.upload).mockResolvedValue({
      public_id: "advientea/2026/teaDay/axvcr1ufv0gpdmwbebmc",
      secure_url:
        "https://res.cloudinary.com/dljj7f5mi/image/upload/v1762707856/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
      url: "http://res.cloudinary.com/dljj7f5mi/image/upload/v1762707856/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
    } as UploadApiResponse);
    vi.mocked(cloudinary.uploader.destroy).mockResolvedValue({ result: "ok" });
  });

  describe("assetFolder", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("puts production under advientea, avatars outside any year", () => {
      vi.stubEnv("VERCEL_ENV", "production");
      expect(assetFolder({ kind: "avatars" })).toBe("advientea/avatars");
      expect(assetFolder({ kind: "teaDay", year: 2026 })).toBe("advientea/2026/teaDay");
    });

    it("sends every Vercel preview, develop included, to advientea-staging", () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(assetFolder({ kind: "teaDay", year: 2026 })).toBe("advientea-staging/2026/teaDay");
    });

    it("treats anything that is not Vercel as local", () => {
      vi.stubEnv("VERCEL_ENV", "");
      expect(assetFolder({ kind: "avatars" })).toBe("advientea-local/avatars");
    });
  });

  describe("uploadImage", () => {
    const png = new File([new Uint8Array([137, 80, 78, 71])], "tea.png", { type: "image/png" });

    it("uploads the file as a data URI with the environment folder in the public id and returns it", async () => {
      vi.stubEnv("VERCEL_ENV", "production");

      const publicId = await uploadImage(png, { kind: "teaDay", year: 2026 });

      expect(cloudinary.uploader.upload).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
        expect.objectContaining({
          allowed_formats: expect.arrayContaining(["png", "jpg"]),
          asset_folder: "advientea/2026/teaDay",
          public_id_prefix: "advientea/2026/teaDay",
        }),
      );
      expect(publicId).toBe("advientea/2026/teaDay/axvcr1ufv0gpdmwbebmc");
      vi.unstubAllEnvs();
    });

    it("returns undefined when Cloudinary rejects the upload", async () => {
      vi.mocked(cloudinary.uploader.upload).mockRejectedValueOnce(new Error("Invalid image file"));

      expect(await uploadImage(png, { kind: "avatars" })).toBeUndefined();
    });
  });

  describe("deleteAsset", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it("deletes an asset of its own environment and returns Cloudinary's answer", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");

      const result = await deleteAsset("advientea-staging/2026/teaDay/axvcr1ufv0gpdmwbebmc");

      expect(cloudinary.uploader.destroy).toHaveBeenCalledWith("advientea-staging/2026/teaDay/axvcr1ufv0gpdmwbebmc", {
        resource_type: "image",
      });
      expect(result?.result).toBe("ok");
    });

    it("production still owns the 2025 assets, which sit under its root in their old folder", async () => {
      vi.stubEnv("VERCEL_ENV", "production");

      await deleteAsset("advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc");

      expect(cloudinary.uploader.destroy).toHaveBeenCalledTimes(1);
    });

    it("refuses a production asset from staging or local: their databases are copies of production", async () => {
      vi.stubEnv("VERCEL_ENV", "preview");
      expect(await deleteAsset("advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc")).toBeUndefined();

      vi.stubEnv("VERCEL_ENV", "");
      expect(await deleteAsset("advientea/2026/teaDay/axvcr1ufv0gpdmwbebmc")).toBeUndefined();

      expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });

    it("refuses the other roots from production even though they start with its name", async () => {
      vi.stubEnv("VERCEL_ENV", "production");

      expect(await deleteAsset("advientea-staging/avatars/axvcr1ufv0gpdmwbebmc")).toBeUndefined();
      expect(await deleteAsset("advientea-local/avatars/axvcr1ufv0gpdmwbebmc")).toBeUndefined();
      expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });

    it("never deletes the shared default avatar, even from production", async () => {
      vi.stubEnv("VERCEL_ENV", "production");

      expect(await deleteAsset(DEFAULT_IMAGE_PROFILE)).toBeUndefined();
      expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
    });

    it("passes Cloudinary's not-found answer through", async () => {
      vi.mocked(cloudinary.uploader.destroy).mockResolvedValueOnce({ result: "not found" });

      const result = await deleteAsset("advientea-local/avatars/gone");

      expect(result?.result).toBe("not found");
    });
  });
});
