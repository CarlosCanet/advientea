"use client";
import { Dispatch, SetStateAction, useState } from "react";
import { FaImages } from "react-icons/fa";

import { ALLOWED_IMAGE_TYPES, ImageStoryForm } from "@/lib/types";

import TeaImageForm from "./TeaImageForm";

interface TeaListImageFormProps {
  images: Array<ImageStoryForm>;
  setImages: Dispatch<SetStateAction<Array<ImageStoryForm>>>;
}

function TeaListImageForm({ images, setImages }: TeaListImageFormProps) {
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
      const newImage: ImageStoryForm = {
        file: imageFile,
        id: crypto.randomUUID(),
        isNew: true,
        order: images.length,
        previewURL: URL.createObjectURL(imageFile),
      };
      const newState: Array<ImageStoryForm> = [...images, newImage];
      setImages(newState);
      event.currentTarget.value = "";
    }
  };

  const handleReorderImage = (imageId: string, newOrderIndex: number) => {
    setImages((prevState) => {
      const indexImageToMove = prevState.findIndex((img) => img.id === imageId);
      if (indexImageToMove < 0 || indexImageToMove === newOrderIndex) {
        return prevState;
      }
      const imageToMove = prevState[indexImageToMove];
      const imagesWithoutImageToMove = prevState.toSpliced(indexImageToMove, 1);
      const imagesWithItemInNewIndex = imagesWithoutImageToMove.toSpliced(newOrderIndex, 0, imageToMove);
      const imagesOrdered = imagesWithItemInNewIndex.map((img, i) => ({ ...img, order: i }));
      return imagesOrdered;
    });
  };

  const handleDeleteImage = (idToDelete: string) => {
    const imageToDelete = images.find((img) => img.id === idToDelete);
    if (!imageToDelete) return;

    // Removed existing images are simply left out of the submitted list; the server deletes what it no longer receives.
    if (imageToDelete.isNew) {
      URL.revokeObjectURL(imageToDelete.previewURL);
    }

    setImages((prevState) =>
      prevState.filter((img) => img.id !== imageToDelete.id).map((img, i) => ({ ...img, order: i })),
    );
  };

  return (
    <div className="flex items-center gap-4 mt-4">
      <fieldset className="fieldset w-full">
        <legend className="fieldset-legend">
          <FaImages />
          Imágenes (07:00 h)
        </legend>
        {images &&
          images.map((img) => (
            <TeaImageForm
              image={img}
              key={img.id}
              onChangeOrder={handleReorderImage}
              onDelete={handleDeleteImage}
              totalImages={images.length}
            />
          ))}
        <input
          aria-label="Seleccionar imagen"
          className="file-input file-input-primary place-self-center file-input-sm"
          onChange={onAddFile}
          type="file"
        />

        {imageErrorMsg && <p className="text-xs text-error font-bold mt-1">{imageErrorMsg}</p>}
      </fieldset>
    </div>
  );
}
export default TeaListImageForm;
