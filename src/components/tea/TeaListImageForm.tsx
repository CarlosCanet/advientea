"use client";
import { cn } from "cn";
import { Dispatch, SetStateAction, useId, useState } from "react";

import TeaImageForm from "@/components/tea/TeaImageForm";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ALLOWED_IMAGE_TYPES, ImageStoryForm } from "@/lib/types";

/** What the images added in one save may weigh together; the ones already saved do not count. */
export const MAX_NEW_IMAGES_BYTES = 2.5 * 1024 * 1024;

export function getNewImagesBytes(images: Array<ImageStoryForm>): number {
  return images.reduce((acc, curr) => (curr.isNew ? acc + curr.file.size : acc), 0);
}

const megabytes = new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 });

// Rounded up, so a total just over the limit never reads as equal to it.
function toMegabytesLabel(bytes: number): string {
  return megabytes.format(Math.ceil((bytes / (1024 * 1024)) * 10) / 10);
}

interface TeaListImageFormProps {
  /** An error about the images from the submit or the server. */
  error?: string;
  /** The hour the images are shown, already formatted. */
  hourLabel: string;
  images: Array<ImageStoryForm>;
  setImages: Dispatch<SetStateAction<Array<ImageStoryForm>>>;
}

function TeaListImageForm({ error, hourLabel, images, setImages }: TeaListImageFormProps) {
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const id = useId();
  const titleId = `${id}-title`;
  const inputId = `${id}-input`;
  const budgetId = `${id}-budget`;
  const errorId = `${id}-error`;

  const newBytes = getNewImagesBytes(images);
  const isOverBudget = newBytes > MAX_NEW_IMAGES_BYTES;
  const errorText =
    imageErrorMsg ||
    error ||
    (isOverBudget ? `Las imágenes nuevas pasan de ${toMegabytesLabel(MAX_NEW_IMAGES_BYTES)} MB: quita alguna.` : "");

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
    <div aria-labelledby={titleId} className="flex flex-col gap-3" role="group">
      <div className="flex flex-col gap-1">
        <h3 className="text-base font-semibold" id={titleId}>
          Imágenes
        </h3>
        <FieldDescription>Se ven a partir de las {hourLabel}, en este orden.</FieldDescription>
      </div>

      {images.length > 0 && (
        <ol aria-label="Imágenes de la historia" className="flex flex-col gap-2">
          {images.map((img) => (
            <TeaImageForm
              image={img}
              key={img.id}
              onChangeOrder={handleReorderImage}
              onDelete={handleDeleteImage}
              totalImages={images.length}
            />
          ))}
        </ol>
      )}

      <Field data-invalid={!!errorText || undefined}>
        <FieldLabel htmlFor={inputId}>Añadir imagen</FieldLabel>
        <Input
          accept={ALLOWED_IMAGE_TYPES.join(",")}
          aria-describedby={`${budgetId}${errorText ? ` ${errorId}` : ""}`}
          aria-invalid={!!errorText || undefined}
          className="text-sm"
          id={inputId}
          onChange={onAddFile}
          type="file"
        />
        <div className="flex flex-col gap-1.5" id={budgetId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">JPG, PNG, GIF o WebP; 2 MB por imagen.</span>
            <span className={cn("shrink-0 tabular-nums", isOverBudget && "font-semibold text-destructive")}>
              <span className="sr-only">Imágenes nuevas: </span>
              {toMegabytesLabel(newBytes)} / {toMegabytesLabel(MAX_NEW_IMAGES_BYTES)} MB
            </span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-foreground/15">
            <div
              className={cn("h-full rounded-full transition-[width]", isOverBudget ? "bg-destructive" : "bg-primary")}
              style={{ width: `${Math.min(newBytes / MAX_NEW_IMAGES_BYTES, 1) * 100}%` }}
            />
          </div>
        </div>
        <FieldError id={errorId}>{errorText}</FieldError>
      </Field>
    </div>
  );
}
export default TeaListImageForm;
