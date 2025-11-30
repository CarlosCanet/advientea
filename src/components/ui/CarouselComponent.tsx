"use client";
import { StoryImage } from "@/generated/prisma/client";
import { CldImage } from "next-cloudinary";
import { useRef, useState } from "react";

interface CarouselComponentProps {
  images: Array<StoryImage>;
}

export default function CarouselComponent({ images }: CarouselComponentProps) {
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null)
  const nextImageId = (actIndex: number): string => {
    return images[(actIndex + 1) % images.length].id;
  }

  const prevImageId = (actIndex: number): string => {
    return images[(actIndex - 1 + images.length) % images.length].id;
  }

  const openModal = (publicId: string) => {
    setSelectedImageId(publicId);
    modalRef.current?.showModal()
  }
  return (
    <>
      <div className="carousel w-full">
        {images.map((image, index) => {
          return (
            <div key={image.id} id={image.id} className="carousel-item relative w-full h-56 items-center justify-center">
              <div className="cursor-zoom-in" onClick={() => openModal(image.publicId)}>
                <CldImage className="object-contain px-1" alt={`Image ${image.order + 1} de la historia`} src={image.publicId} fill={true} />
              </div>
              <div className="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between pointer-events-none">
                <a href={`#${prevImageId(index)}`} className="btn btn-circle pointer-events-auto">❮</a>
                <a href={`#${nextImageId(index)}`} className="btn btn-circle pointer-events-auto">❯</a>
              </div>
            </div>
          );
        })}
      </div>
      <dialog ref={modalRef} className="modal">
        <div className="modal-box w-auto  max-h-screen bg-transparent! shadow-none overflow-hidden flex flex-col items-center justify-center">
          <form method="dialog" className="self-end z-50">
            <button className="btn btn-sm btn-circle btn-primary text-white">✕</button>
          </form>
          {selectedImageId && (
            <CldImage
                src={selectedImageId}
                alt="Imagen a pantalla completa"
                className="object-contain -mt-8 max-h-[95vh] max-w-[95vw] w-auto h-auto"
                width={1400}
                height={1400}
              />
          )}
        </div>
      </dialog>
      <form method="dialog" className="modal-backdrop">
        <button onClick={() => setSelectedImageId(null)}>close</button>
      </form>
    </>
  );
}
