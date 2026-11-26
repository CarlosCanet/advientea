"use client";
import { ArrowDown, ArrowUp } from "lucide-react";
import { CldImage } from "next-cloudinary";
import Image from "next/image";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ImageStoryForm } from "@/lib/types";

interface TeaImageFormProps {
  image: ImageStoryForm;
  onChangeOrder: (id: string, newOrder: number) => void;
  onDelete: (id: string) => void;
  /** Lets the list move the focus to this row after another one is removed. */
  removeButtonRef?: React.Ref<HTMLButtonElement>;
  totalImages: number;
}

function TeaImageForm({ image, onChangeOrder, onDelete, removeButtonRef, totalImages }: TeaImageFormProps) {
  const position = image.order + 1;
  const alt = `Imagen ${position} de la historia`;

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
    <li className="flex items-center gap-3 rounded-xl bg-popover p-2 ring-1 ring-foreground/10">
      <div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-20">
        {image.isNew ? (
          <Image alt={alt} className="size-full object-cover" height={160} src={image.previewURL} width={160} />
        ) : (
          <CldImage alt={alt} className="size-full object-cover" height={160} src={image.publicId} width={160} />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex items-center gap-2 text-sm font-medium">
          Imagen {position}
          {image.isNew && <Badge variant="outline">Nueva</Badge>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Focusable while disabled: moving an image to an end must not drop the keyboard focus. */}
          <Button
            aria-label={`Mover imagen ${position} arriba`}
            className="data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:active:not-aria-[haspopup]:translate-y-0"
            disabled={image.order === 0}
            focusableWhenDisabled
            onClick={handleDecreasePosition}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowUp />
          </Button>
          <Button
            aria-label={`Mover imagen ${position} abajo`}
            className="data-disabled:opacity-50 data-disabled:hover:bg-transparent data-disabled:active:not-aria-[haspopup]:translate-y-0"
            disabled={image.order === totalImages - 1}
            focusableWhenDisabled
            onClick={handleIncreasePosition}
            size="icon"
            type="button"
            variant="outline"
          >
            <ArrowDown />
          </Button>
          <Button
            aria-label={`Quitar imagen ${position}`}
            className="ml-auto border-destructive/50 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => onDelete(image.id)}
            ref={removeButtonRef}
            size="sm"
            type="button"
            variant="outline"
          >
            Quitar
          </Button>
        </div>
      </div>
    </li>
  );
}
export default TeaImageForm;
