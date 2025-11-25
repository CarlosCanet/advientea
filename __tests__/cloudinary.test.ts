import "@/envConfig"
import { CloudinaryFolders, deleteAsset, getAssetInfo, uploadImage } from "@/lib/cloudinary";
import "@testing-library/jest-dom";
import { v2 as cloudinary } from "cloudinary";

jest.mock("cloudinary", () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
    api: {
      resource: jest.fn(),
    },
  },
}));

describe("Cloudinary integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (cloudinary.uploader.upload as jest.Mock).mockResolvedValue({
      public_id: "advientea/2025-Caoslendario/axvcr1ufv0gpdmwbebmc",
      url: "http://res.cloudinary.com/dljj7f5mi/image/upload/v1762707856/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
      secure_url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1762707856/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
    });
    (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: "ok" });
    (cloudinary.api.resource as jest.Mock).mockResolvedValue({
      asset_id: "5de5e79847577b586aa5d1849bfde8ca",
      public_id: "advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc",
      url: "http://res.cloudinary.com/dljj7f5mi/image/upload/v1762707272/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
      secure_url: "https://res.cloudinary.com/dljj7f5mi/image/upload/v1762707272/advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc.png",
    });
  });

  describe("uploadImage", () => {
    it("should upload an image and return url and publicId", async () => {
      const mockImageData =
        "data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEACAIAAADTED8xAAADSklEQVR4nOzVIW4UYBhF0WEyBgskaDA4VjFjWAOGJUCCJcEjQCBJkARFIEHUVLSirrZdwaiabqBdxC++NPecFTxz83b/L19tHrLfm5/TE5b82v+bnrDk/f7d9IQl2+kBMEkApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEh79PTlxfSGJS+uvkxPWHL8+HZ6wpLv53+nJyzxAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpu+uvT6Y3LPlxPExPWPLt5MP0hCXbP5+nJyzxAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpAiBNAKQJgDQBkCYA0gRAmgBIEwBpu7Pb59MbltzcvZmesOTTs9PpCUsOj19PT1jiAUgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDSBECaAEgTAGkCIE0ApAmANAGQJgDS7gMAAP//yh4Z+WMgoO4AAAAASUVORK5CYII=";
      const result = await uploadImage(mockImageData, CloudinaryFolders.AVATARS);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("public_id");
      if (result && result.public_id) {
        expect(result.public_id).toBeTruthy();
        expect(result.public_id).toContain("advientea/2025-Caoslendario/");
        console.log("PUBLIC_ID:", result.public_id);
      }
    });
  });

  describe("getAssetInfo", () => {
    it("should return the info for an upload image", async () => {
      const publicId = "advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc";
      const result = await getAssetInfo(publicId);

      expect(result).toBeDefined();
      expect(typeof result).toBe("object");
      expect(result).toHaveProperty("public_id");
      expect(result).toHaveProperty("secure_url");
      if (result && result.public_id) {
        expect(result.public_id).toContain("advientea/2025-Caoslendario/");
        expect(result.public_id).toBe(publicId);
        expect(result.secure_url).toContain("advientea/2025-Caoslendario/");
        expect(result.secure_url).toContain(publicId);
      }
    });

    it("should return undefined for a non-existent publicId", async () => {
      (cloudinary.api.resource as jest.Mock).mockRejectedValueOnce(undefined);
      
      const result = await getAssetInfo("nnnnaaaokok123123123.$$$");
      expect(result).toBeUndefined();
    });
  });

  describe("deleteImage", () => {
    it("should delete asset and return success result", async () => {
      const publicId = "advientea/2025-Caoslendario/avatars/axvcr1ufv0gpdmwbebmc";
      const result = await deleteAsset(publicId);
      console.log("DELETE:", result);

      expect(result).toBeDefined();
      if (result) {
        expect(typeof result).toBe("object");
        expect(result).toHaveProperty("result");
        expect(result.result).toBe("ok");
      }
    });

    it("should return not-found for a non-existent publicId", async () => {
      (cloudinary.uploader.destroy as jest.Mock).mockResolvedValueOnce({ result: "not found" });
      
      const result = await deleteAsset("nnnnaaaokok123123123.$$$");
      expect(result).toBeDefined();
      if (result) {
        expect(typeof result).toBe("object");
        expect(result).toHaveProperty("result");
        expect(result.result).toBe("not found");
      }
    });
  });
});
