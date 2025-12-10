"use client";
import { FaImages } from "react-icons/fa"
import { Dispatch, SetStateAction, useState } from "react";
import { ImageStoryForm } from "@/lib/types";
import TeaImageForm from "./TeaImageForm";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/svg+xml", "image/webp"];

interface TeaListImageFormProps {
  images: Array<ImageStoryForm>,
  setImages: Dispatch<SetStateAction<Array<ImageStoryForm>>>,
  setStoryImageIdsToDelete?: Dispatch<SetStateAction<Array<string>>>
}

function TeaListImageForm({ images, setImages, setStoryImageIdsToDelete }: TeaListImageFormProps) {
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  
  const onAddFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageErrorMsg("");
    if (event.target.files && event.target.files.length > 0) {
      const imageFile = event.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        event.currentTarget.value = "";
        setImageErrorMsg("Tipo de fichero no permitido");
        return;
      }
      const newImage: ImageStoryForm = { id: crypto.randomUUID(), order: images.length, isNew: true, file: imageFile, previewURL: URL.createObjectURL(imageFile) };
      const newState: Array<ImageStoryForm> = [...images, newImage];
      setImages(newState);
      event.currentTarget.value = "";
    }
  };

  const handleReorderImage = (imageId: string, newOrderIndex: number) => {
    setImages(prevState => {
      const indexImageToMove = prevState.findIndex(img => img.id === imageId);
      if (indexImageToMove < 0 || indexImageToMove === newOrderIndex) {
        return prevState;
      }
      const imageToMove = prevState[indexImageToMove]
      const imagesWithoutImageToMove = prevState.toSpliced(indexImageToMove, 1);
      const imagesWithItemInNewIndex = imagesWithoutImageToMove.toSpliced(newOrderIndex, 0, imageToMove);
      const imagesOrdered = imagesWithItemInNewIndex.map((img, i) => ({ ...img, order: i }));      
      return imagesOrdered;
    });
  };

  const handleDeleteImage = (idToDelete: string) => {
    const imageToDelete = images.find(img => img.id === idToDelete);
    if (!imageToDelete) return;
    
    if (imageToDelete.isNew) {
      URL.revokeObjectURL(imageToDelete.previewURL);
    } else {
      setStoryImageIdsToDelete?.((prevState) => [...prevState, imageToDelete.id]);
    }

    setImages((prevState) => prevState.filter((img) => img.id !== imageToDelete.id).map((img, i) => ({ ...img, order: i })));
  };
  
  return (
    <div className="flex items-center gap-4 mt-4">
      <fieldset className="fieldset w-full">
        <legend className="fieldset-legend"><FaImages />Imágenes (07:00 h)</legend>
        {images &&
          images.map(img => <TeaImageForm key={img.id} image={img} totalImages={images.length} onDelete={handleDeleteImage} onChangeOrder={handleReorderImage} />)
        }
        <input type="file" className="file-input file-input-primary place-self-center file-input-sm" onChange={onAddFile} aria-label="Seleccionar imagen" />
        
        {imageErrorMsg && <p className="text-xs text-error font-bold mt-1">{imageErrorMsg}</p>}
      </fieldset>
    </div>
  )
}
export default TeaListImageForm