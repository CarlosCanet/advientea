"use client";
import { CldImage } from "next-cloudinary";
import { useRef, useState } from "react";

import { StoryImage } from "@/generated/prisma/client";

interface CarouselComponentProps {
  images: Array<StoryImage>;
}

export default function CarouselComponent({ images }: CarouselComponentProps) {
  const [selectedImageId, setSelectedImageId] = useState<null | string>(null);
  const modalRef = useRef<HTMLDialogElement>(null);
  const nextImageId = (actIndex: number): string => {
    return images[(actIndex + 1) % images.length].id;
  };

  const prevImageId = (actIndex: number): string => {
    return images[(actIndex - 1 + images.length) % images.length].id;
  };

  const openModal = (publicId: string) => {
    setSelectedImageId(publicId);
    modalRef.current?.showModal();
  };
  return (
    <>
      <div className="carousel w-full">
        {images.map((image, index) => {
          return (
            <div
              className="carousel-item relative w-full h-56 items-center justify-center"
              id={image.id}
              key={image.id}
            >
              <div className="cursor-zoom-in" onClick={() => openModal(image.publicId)}>
                <CldImage
                  alt={`Image ${image.order + 1} de la historia`}
                  className="object-contain px-1"
                  fill={true}
                  src={image.publicId}
                />
              </div>
              <div className="absolute left-5 right-5 top-1/2 flex -translate-y-1/2 transform justify-between pointer-events-none">
                <a className="btn btn-circle pointer-events-auto" href={`#${prevImageId(index)}`}>
                  ❮
                </a>
                <a className="btn btn-circle pointer-events-auto" href={`#${nextImageId(index)}`}>
                  ❯
                </a>
              </div>
            </div>
          );
        })}
      </div>
      <dialog className="modal" ref={modalRef}>
        <div className="modal-box w-screen max-w-11/12 max-h-11/12 bg-transparent! shadow-none overflow-hidden flex flex-col items-center justify-start p-0">
          <form className="self-end z-50 p-2" method="dialog">
            <button className="btn btn-sm btn-circle btn-primary text-white">✕</button>
          </form>
          {selectedImageId && (
            <CldImage
              alt="Imagen a pantalla completa"
              className="object-contain w-full h-full"
              height={1080}
              src={selectedImageId}
              width={1920}
            />
          )}
        </div>
      </dialog>
      <form className="modal-backdrop" method="dialog">
        <button onClick={() => setSelectedImageId(null)}>close</button>
      </form>
    </>
  );
}
