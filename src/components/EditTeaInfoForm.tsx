"use client";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { BsCupHotFill } from "react-icons/bs";
import { FaCalendar, FaClock, FaStore, FaUser } from "react-icons/fa";
import { FaMusic, FaRepeat, FaTemperatureFull } from "react-icons/fa6";
import { MdComputer, MdMore } from "react-icons/md";
import { SiUndertale } from "react-icons/si";

import { editTeaInfoAction } from "@/app/actions/teaInfoActions";
import { Prisma } from "@/generated/prisma/client";
import { ImageStoryForm, initialTeaInfoActionResponse } from "@/lib/types";

import TeaListImageForm from "./ui/TeaListImageForm";

interface EditTeaInfoFormProps {
  dayNumber: number | undefined;
  isExecuTEAve: boolean;
  teaCompleteInfo: Prisma.TeaGetPayload<{ include: { story: { include: { images: true } } } }>;
  teaId: string;
  username: string;
}

function initImages(teaCompleteInfo: Prisma.TeaGetPayload<{ include: { story: { include: { images: true } } } }>) {
  if (teaCompleteInfo.story && teaCompleteInfo.story.images.length > 0) {
    const oldImages: Array<ImageStoryForm> = teaCompleteInfo.story.images.map((img, i) => ({
      id: img.id,
      isNew: false,
      order: i,
      publicId: img.publicId,
    }));
    return oldImages;
  }
  return [];
}

function EditTeaInfoForm({ dayNumber, isExecuTEAve, teaCompleteInfo, teaId, username }: EditTeaInfoFormProps) {
  const [state, action, isPending] = useActionState(editTeaInfoAction, initialTeaInfoActionResponse);
  const [images, setImages] = useState<Array<ImageStoryForm>>(() => initImages(teaCompleteInfo));
  const [imageSizeError, setImageSizeError] = useState<string>("");
  const router = useRouter();

  useEffect(() => {
    return () => {
      images.forEach((img) => {
        if (img.isNew) {
          URL.revokeObjectURL(img.previewURL);
        }
      });
    };
  }, [images]);
  useEffect(() => {
    if (state.success) {
      router.push("/");
    }
  }, [state, router]);
  const errors = state.errors?.properties ?? undefined;
  const imagesError = imageSizeError ?? state.errors?.properties?.images?.errors.join(" ");

  const onSubmit = (formData: FormData) => {
    const totalSize = images.reduce((acc, curr) => (curr.isNew ? acc + curr.file.size : acc), 0);
    if (totalSize > 2.5 * 1024 * 1024) {
      setImageSizeError("El tamaño total de las imágenes es superior al permitido");
      return;
    }
    images.forEach((img) => {
      if (img.isNew) {
        formData.append("images", img.file);
        formData.append("images_order", img.order.toString());
      } else {
        formData.append("kept_images", img.id);
        formData.append("kept_images_order", img.order.toString());
      }
    });
    formData.append("tea_id", teaId);
    action(formData);
  };

  return (
    <div className="card w-full mx-10 bg-base-100 shadow-xl mt-10 mb-10 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-10 before:pointer-events-none">
      <Form action={onSubmit} className="card-body">
        <h2 className="card-title">
          <div>
            Editar<span className="italic">Té</span>
          </div>
        </h2>
        <div className="items-center mt-2">
          <div className="flex gap-2">
            <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
              <FaUser />
              <input
                className="grow"
                defaultValue={username}
                name="personName"
                placeholder="Nombre de la persona"
                readOnly
                required
                type="text"
              />
            </label>
            {errors?.personName && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.personName.errors.join(", ")}</p>
            )}
            <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
              <FaCalendar />
              <input
                className="grow"
                defaultValue={dayNumber}
                min={0}
                name="dayNumber"
                placeholder="Día asignado"
                readOnly={!isExecuTEAve}
                required
                type="text"
              />
            </label>
            {errors?.dayNumber && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.dayNumber.errors.join(", ")}</p>
            )}
          </div>

          <div className="divider divider-neutral">Info del té</div>

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <BsCupHotFill />
            <input
              className="grow"
              defaultValue={state.inputs?.teaName ?? teaCompleteInfo.name}
              name="teaName"
              placeholder="Nombre del té"
              required
              type="text"
            />
          </label>
          {errors?.teaName && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.teaName.errors.join(", ")}</p>
          )}
          <div className="flex gap-2">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaTemperatureFull />
              <input
                className="grow"
                defaultValue={state.inputs?.temperature ?? teaCompleteInfo.temperature}
                max={150}
                min={30}
                name="temperature"
                placeholder="Temperatura"
                required
                type="number"
              />
            </label>
            {errors?.temperature && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.temperature.errors.join(", ")}</p>
            )}
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaClock />
              <input
                className="grow"
                defaultValue={state.inputs?.infusionTime ?? teaCompleteInfo.infusionTime}
                max={30}
                min={1}
                name="infusionTime"
                placeholder="Tiempo de infusión"
                required
                type="number"
              />
            </label>
            {errors?.infusionTime && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.infusionTime.errors.join(", ")}</p>
            )}
          </div>
          <div className="flex gap-2 my-2 py-2">
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Tiene teína?
              <input
                className="checkbox"
                defaultChecked={state.inputs?.hasTheine ?? teaCompleteInfo.hasTheine}
                name="hasTheine"
                type="checkbox"
              />
            </label>
            {errors?.hasTheine && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.hasTheine.errors.join(", ")}</p>
            )}
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Con leche?
              <input
                className="checkbox"
                defaultChecked={state.inputs?.addMilk ?? teaCompleteInfo.addMilk}
                name="addMilk"
                type="checkbox"
              />
            </label>
            {errors?.addMilk && (
              <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.addMilk.errors.join(", ")}</p>
            )}
          </div>
          <div className="flex gap-2 my-2">
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Reinfusiona?
              <input
                className="checkbox"
                defaultChecked={state.inputs?.canReinfuse ?? teaCompleteInfo.canReinfuse}
                name="canReinfuse"
                type="checkbox"
              />
            </label>
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaRepeat />
              <input
                className="grow"
                defaultValue={state.inputs?.reinfuseNumber ?? teaCompleteInfo.reinfuseNumber ?? 0}
                min={0}
                name="reinfuseNumber"
                placeholder="¿Cuántas veces?"
                type="number"
              />
            </label>
          </div>
          {errors?.canReinfuse && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.canReinfuse.errors.join(", ")}</p>
          )}
          {errors?.reinfuseNumber && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.reinfuseNumber.errors.join(", ")}</p>
          )}

          <div className="divider">Opcional</div>

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdMore />
            <input
              className="grow"
              defaultValue={state.inputs?.moreIndications ?? teaCompleteInfo.moreIndications ?? ""}
              name="moreIndications"
              placeholder="Más indicaciones"
              type="text"
            />
          </label>
          {errors?.moreIndications && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.moreIndications.errors.join(", ")}</p>
          )}
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <FaStore />
            <input
              className="grow"
              defaultValue={state.inputs?.storeName ?? teaCompleteInfo.storeName ?? ""}
              name="storeName"
              placeholder="Nombre de la tienda"
              type="text"
            />
          </label>
          {errors?.storeName && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.storeName.errors.join(", ")}</p>
          )}
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdComputer />
            <input
              className="grow"
              defaultValue={state.inputs?.urlStore ?? teaCompleteInfo.url ?? ""}
              name="urlStore"
              placeholder="Web de la tienda"
              type="text"
            />
          </label>
          {errors?.urlStore && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.urlStore.errors.join(", ")}</p>
          )}
        </div>

        <div className="divider divider-neutral">Ambientación</div>

        <label className="label justify-center text-center">
          No tienes que rellenar toda la ambientación, <br />
          sólo lo que te interese o hayas podido
        </label>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            <SiUndertale /> Historia
          </legend>
          <label className="label">Parte 1 (07:00 h)</label>
          <textarea
            className="textarea w-full"
            defaultValue={state.inputs?.storyPart1 ?? teaCompleteInfo.story?.storyPart1 ?? ""}
            name="storyPart1"
            placeholder="Historia: parte 1"
          />
          <label className="label">Parte 2 (13:00 h)</label>
          <textarea
            className="textarea w-full"
            defaultValue={state.inputs?.storyPart2 ?? teaCompleteInfo.story?.storyPart2 ?? ""}
            name="storyPart2"
            placeholder="Historia: parte 2"
          />
          <label className="label">Parte 3 (18:00 h)</label>
          <textarea
            className="textarea w-full"
            defaultValue={state.inputs?.storyPart3 ?? teaCompleteInfo.story?.storyPart3 ?? ""}
            name="storyPart3"
            placeholder="Historia: parte 3"
          />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend">
            <FaMusic /> Vídeo o música (07:00 h)
          </legend>
          <div className="flex gap-2 items-center">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <input
                className="grow"
                defaultValue={state.inputs?.youtubeURL ?? teaCompleteInfo.story?.youtubeURL ?? ""}
                name="youtubeURL"
                placeholder="Enlace de youtube a video o música"
                type="text"
              />
            </label>
            <label className="label flex justify-center items-center">
              ¿Sólo música?
              <input
                className="checkbox"
                defaultChecked={state.inputs?.onlyMusic ?? teaCompleteInfo.story?.onlyMusic ?? false}
                name="onlyMusic"
                type="checkbox"
              />
            </label>
          </div>
          {errors?.youtubeURL && (
            <p className="text-xs text-error font-bold mt-2 mb-2">{errors.youtubeURL.errors.join(", ")}</p>
          )}
          {errors?.onlyMusic && (
            <p className="text-xs text-error font-bold mt-2 mb-2">{errors.onlyMusic.errors.join(", ")}</p>
          )}
        </fieldset>
        <TeaListImageForm images={images} setImages={setImages} />
        {imagesError && <p className="text-xs text-error font-bold self-center -mt-2 mb-2">{imagesError}</p>}

        <div className="card-actions justify-center mt-4 gap-2">
          <button className="btn btn-error" onClick={() => router.back()} type="button">
            Cancelar
          </button>
          <button className="btn btn-primary" disabled={isPending} type="submit">
            {isPending ? <span className="loading loading-spinner"></span> : "EdiTélo"}
          </button>
        </div>
      </Form>
    </div>
  );
}
export default EditTeaInfoForm;
