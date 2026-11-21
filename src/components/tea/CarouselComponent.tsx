"use client";
import { CldImage } from "next-cloudinary";
import { useEffect, useState } from "react";

import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { StoryImage } from "@/generated/prisma/client";

interface CarouselComponentProps {
  images: Array<StoryImage>;
}

export default function CarouselComponent({ images }: CarouselComponentProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    if (!api) {
      return;
    }
    const onSelect = () => setCurrentIndex(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  if (images.length === 0) {
    return null;
  }

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setIsLightboxOpen(true);
  };
  const lightboxImage = images[lightboxIndex];

  return (
    <>
      <Carousel aria-label="Imágenes de la historia" className="w-full" opts={{ loop: true }} setApi={setApi}>
        <CarouselContent>
          {images.map((image, index) => (
            <CarouselItem aria-label={`Imagen ${index + 1} de ${images.length}`} key={image.id}>
              <button
                aria-label={`Ampliar imagen ${index + 1}`}
                className="relative block h-56 w-full cursor-zoom-in rounded-xl outline-none focus-visible:focus-ring"
                onClick={() => openLightbox(index)}
                type="button"
              >
                <CldImage
                  alt={`Imagen ${image.order + 1} de la historia`}
                  className="object-contain px-1"
                  fill={true}
                  sizes="(min-width: 640px) 36rem, 100vw"
                  src={image.publicId}
                />
              </button>
            </CarouselItem>
          ))}
        </CarouselContent>
        {images.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-4">
            <CarouselPrevious aria-label="Imagen anterior" className="static inset-auto my-0" />
            <p aria-live="polite" className="min-w-12 text-center text-sm font-medium tabular-nums">
              {currentIndex + 1} / {images.length}
            </p>
            <CarouselNext aria-label="Imagen siguiente" className="static inset-auto my-0" />
          </div>
        )}
      </Carousel>
      <Dialog onOpenChange={setIsLightboxOpen} open={isLightboxOpen}>
        <DialogContent className="gap-3 p-3 pt-4 sm:max-w-4xl">
          <DialogTitle className="ps-2 pe-12 leading-8">
            Imagen {lightboxIndex + 1} / {images.length}
          </DialogTitle>
          {lightboxImage && (
            <CldImage
              alt={`Imagen ${lightboxImage.order + 1} de la historia`}
              className="h-auto max-h-[80svh] w-full rounded-2xl object-contain"
              height={1080}
              src={lightboxImage.publicId}
              width={1920}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
