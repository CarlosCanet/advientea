"use client";
import { CldImage } from "next-cloudinary";
import Image from "next/image";
import { IoIosArrowDown, IoIosArrowUp } from "react-icons/io";

import { ImageStoryForm } from "@/lib/types";

interface TeaImageFormProps {
  image: ImageStoryForm;
  onChangeOrder: (id: string, newOrder: number) => void;
  onDelete: (id: string) => void;
  totalImages: number;
}

function TeaImageForm({ image, onChangeOrder, onDelete, totalImages }: TeaImageFormProps) {
  const handleIncreasePosition = () => {
    if (image.order < totalImages - 1) {
      onChangeOrder(image.id, image.order + 1);
    }
  };

  const handleDecreasePosition = () => {
    if (image.order > 0) {
      onChangeOrder(image.id, image.order - 1);
    }
  };

  return (
    <div className="flex justify-center items-center gap-4 mt-4">
      <div className="w-full h-32 overflow-hidden flex items-center justify-center">
        {image.isNew ? (
          <Image
            alt="User profile preview"
            className="object-cover w-full h-full"
            height={96}
            src={image.previewURL}
            width={96}
          />
        ) : (
          <CldImage
            alt="User profile preview"
            className="object-cover w-full h-full"
            height={600}
            src={image.publicId}
            width={600}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 w-1/4">
        <div className="flex flex-row justify-center items-center w-full gap-1">
          <button
            className="btn btn-xs btn-soft btn-secondary"
            disabled={image.order === 0}
            onClick={handleDecreasePosition}
            type="button"
          >
            <IoIosArrowUp />
          </button>
          <button
            className="btn btn-xs btn-soft btn-secondary"
            disabled={image.order === totalImages - 1}
            onClick={handleIncreasePosition}
            type="button"
          >
            <IoIosArrowDown />
          </button>
        </div>
        <button className="btn btn-soft btn-error" onClick={() => onDelete(image.id)} type="button">
          Borrar imagen
        </button>
      </div>
    </div>
  );
}
export default TeaImageForm;
