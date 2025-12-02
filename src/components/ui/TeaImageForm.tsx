"use client";
import Image from "next/image";
import { ImageStoryForm } from "@/lib/types";
import { CldImage } from "next-cloudinary";

interface TeaImageFormProps {
  
  image: ImageStoryForm;
  totalImages: number;
  onDelete: (id: string) => void;
  onChangeOrder: (id: string, newOrder: number) => void;
}

function TeaImageForm({ image, totalImages, onDelete, onChangeOrder }: TeaImageFormProps) {
  
  const handleOrderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(event.target.value);
    if (!isNaN(value) && value >= 1 && value <= totalImages) {
      onChangeOrder(image.id, value - 1);
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

      <div className="flex flex-col gap-2 w-1/4">
        <label className="input input-bordered floating-label flex items-center gap-2 mb-2 w-full">
          <span>Posición</span>
          <input type="number" className="grow text-center" placeholder="1" onChange={handleOrderChange} required min={1} max={totalImages} value={image.order + 1} />
        </label>
        <button className="btn btn-soft btn-error" type="button" onClick={() => onDelete(image.id)}>Borrar imagen</button>
      </div>
    </div>
  );
}
export default TeaImageForm;
