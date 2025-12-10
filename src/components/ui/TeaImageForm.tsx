"use client";
import Image from "next/image";
import { ImageStoryForm } from "@/lib/types";
import { CldImage } from "next-cloudinary";
import { IoIosArrowUp, IoIosArrowDown } from "react-icons/io";

interface TeaImageFormProps {  
  image: ImageStoryForm;
  totalImages: number;
  onDelete: (id: string) => void;
  onChangeOrder: (id: string, newOrder: number) => void;
}

function TeaImageForm({ image, totalImages, onDelete, onChangeOrder }: TeaImageFormProps) {
  const handleIncreasePosition = () => {
    if (image.order < totalImages - 1) {
      onChangeOrder(image.id, image.order + 1);
    }
  }

  const handleDecreasePosition = () => {
    if (image.order > 0) {
      onChangeOrder(image.id, image.order - 1);
    }
  }

  return (    
    <div className="flex justify-center items-center gap-4 mt-4">
      <div className="w-full h-32 overflow-hidden flex items-center justify-center">
        {image.isNew ? (
          <Image src={image.previewURL} alt="User profile preview" className="object-cover w-full h-full" width={96} height={96} />
        ) : (
          <CldImage src={image.publicId} alt="User profile preview" className="object-cover w-full h-full" width={600} height={600} />
        )}
      </div>

      <div className="flex flex-col gap-4 w-1/4">
          <div className="flex flex-row justify-center items-center w-full gap-1">
            <button className="btn btn-xs btn-soft btn-secondary" type="button" onClick={handleDecreasePosition} disabled={image.order === 0}><IoIosArrowUp /></button>
            <button className="btn btn-xs btn-soft btn-secondary" type="button" onClick={handleIncreasePosition} disabled={image.order === totalImages - 1}><IoIosArrowDown /></button>
          </div>
        <button className="btn btn-soft btn-error" type="button" onClick={() => onDelete(image.id)}>Borrar imagen</button>
      </div>
    </div>
  );
}
export default TeaImageForm;
