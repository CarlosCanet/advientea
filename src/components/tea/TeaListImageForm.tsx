"use client";
import { cn } from "cn";
import {
  Dispatch,
  SetStateAction,
  useEffect,
  useId,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import TeaImageForm from "@/components/tea/TeaImageForm";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  getNewImagesBytes,
  isImageTooLarge,
  isOverNewImagesBudget,
  MAX_IMAGE_BYTES,
  MAX_NEW_IMAGES_BYTES,
  toMegabytesLabel,
} from "@/lib/image-budget";
import { ALLOWED_IMAGE_TYPES, ImageStoryForm } from "@/lib/types";

/** Why a save with these images cannot start, or an empty string when it can. */
export function toImagesBudgetError(images: ReadonlyArray<ImageStoryForm>): string {
  return isOverNewImagesBudget(getNewImagesBytes(images))
    ? `Las imágenes nuevas pasan de ${toMegabytesLabel(MAX_NEW_IMAGES_BYTES)} MB: quita alguna.`
    : "";
}

/** What the form may ask of the image list. */
export interface TeaListImageFormHandle {
  /** Focuses the "Quitar" of the last new image, the one to drop when a save is over budget, else "Añadir imagen". */
  focusLastNewImage: () => void;
}

interface TeaListImageFormProps {
  /** An error about the images from the server. */
  error?: string;
  /** The hour the images are shown, already formatted. */
  hourLabel: string;
  images: Array<ImageStoryForm>;
  ref?: React.Ref<TeaListImageFormHandle>;
  setImages: Dispatch<SetStateAction<Array<ImageStoryForm>>>;
}

function TeaListImageForm({ error, hourLabel, images, ref, setImages }: TeaListImageFormProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  /** The image whose "Quitar" takes the focus once a removal renders; null for the file input. */
  const focusAfterRemove = useRef<null | { imageId: null | string }>(null);
  const latestImages = useRef(images);
  const id = useId();
  const titleId = `${id}-title`;
  const inputId = `${id}-input`;
  const budgetId = `${id}-budget`;
  const errorId = `${id}-error`;

  const newBytes = getNewImagesBytes(images);
  const isOverBudget = isOverNewImagesBudget(newBytes);
  const errorText = [imageErrorMsg, toImagesBudgetError(images), error].filter(Boolean).join(" ");

  useImperativeHandle(ref, () => ({
    focusLastNewImage() {
      const lastNew = images.findLast((img) => img.isNew);
      const target = lastNew ? removeButtons.current.get(lastNew.id) : inputRef.current;
      target?.focus();
    },
  }));

  // Before paint, so the focus never rests on the page body between the removal and the next row.
  useLayoutEffect(() => {
    latestImages.current = images;
    const pending = focusAfterRemove.current;
    if (pending) {
      focusAfterRemove.current = null;
      const target = pending.imageId ? removeButtons.current.get(pending.imageId) : inputRef.current;
      target?.focus();
    }
  }, [images]);

  // Previews of removed images are revoked as they go; the rest only when the form goes away, since a
  // reorder or a save that fails keeps showing them.
  useEffect(() => {
    return () => {
      latestImages.current.forEach((img) => {
        if (img.isNew) {
          URL.revokeObjectURL(img.previewURL);
        }
      });
    };
  }, []);

  const onAddFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageErrorMsg("");
    if (event.target.files && event.target.files.length > 0) {
      const imageFile = event.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        event.currentTarget.value = "";
        setImageErrorMsg("Tipo de fichero no permitido");
        return;
      }
      if (isImageTooLarge(imageFile.size)) {
        event.currentTarget.value = "";
        setImageErrorMsg(`La imagen pesa más de ${toMegabytesLabel(MAX_IMAGE_BYTES)} MB.`);
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
    const index = images.findIndex((img) => img.id === idToDelete);
    if (index < 0) {
      return;
    }
    const imageToDelete = images[index];
    const remaining = images.toSpliced(index, 1);
    focusAfterRemove.current = { imageId: (remaining[index] ?? remaining[index - 1])?.id ?? null };

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
              removeButtonRef={(element: HTMLButtonElement | null) => {
                if (element) {
                  removeButtons.current.set(img.id, element);
                }
                return () => {
                  removeButtons.current.delete(img.id);
                };
              }}
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
          ref={inputRef}
          type="file"
        />
        <div className="flex flex-col gap-1.5" id={budgetId}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="text-muted-foreground">
              JPG, PNG, GIF o WebP; {toMegabytesLabel(MAX_IMAGE_BYTES)} MB por imagen.
            </span>
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
