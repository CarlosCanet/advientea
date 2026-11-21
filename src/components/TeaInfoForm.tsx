"use client";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { BsCupHotFill } from "react-icons/bs";
import { FaClock, FaStore } from "react-icons/fa";
import { FaMusic, FaRepeat, FaTemperatureFull } from "react-icons/fa6";
import { MdComputer, MdMore } from "react-icons/md";
import { SiUndertale } from "react-icons/si";

import type { Prisma } from "@/generated/prisma/client";

import { showActionToast } from "@/lib/action-toast";
import { ImageStoryForm, initialTeaInfoActionResponse, TeaInfoActionResponse } from "@/lib/types";

import TeaListImageForm from "./ui/TeaListImageForm";

type TeaWithStoryImages = Prisma.TeaGetPayload<{ include: { story: { include: { images: true } } } }>;

interface TeaInfoFormProps {
  action: (prevState: null | TeaInfoActionResponse, formData: FormData) => Promise<TeaInfoActionResponse>;
  /** A line above the day, such as the guest's greeting. */
  greeting?: string;
  heading: string;
  subheading?: string;
  /** The tea as saved, to prefill the form; none when the participant has not uploaded it yet. */
  tea?: null | TeaWithStoryImages;
  /** Only for editTeaInfoAction, which saves the tea named by it. */
  teaId?: string;
}

function initImages(tea: null | TeaWithStoryImages | undefined): Array<ImageStoryForm> {
  if (!tea?.story) {
    return [];
  }
  return tea.story.images.map((img, i) => ({ id: img.id, isNew: false, order: i, publicId: img.publicId }));
}

interface TeaInfoFormFieldsProps extends Omit<TeaInfoFormProps, "action"> {
  action: (formData: FormData) => void;
  isPending: boolean;
  state: TeaInfoActionResponse;
}

/**
 * The tea form of a participation, for /my-tea and the managers' editor. The action state lives here, above
 * the fields, because the fields are mounted again whenever the saved tea changes (so that the image list
 * starts over from the rows the save left behind), and the response that brings the new tea also brings the
 * result to toast.
 */
function TeaInfoForm({ action: saveAction, ...props }: TeaInfoFormProps) {
  const [state, action, isPending] = useActionState(saveAction, initialTeaInfoActionResponse);
  useEffect(() => {
    if (state.message) {
      showActionToast(state);
    }
  }, [state]);
  return (
    <TeaInfoFormFields
      action={action}
      isPending={isPending}
      key={props.tea?.updatedAt.toISOString() ?? "new"}
      state={state}
      {...props}
    />
  );
}

function TeaInfoFormFields({
  action,
  greeting,
  heading,
  isPending,
  state,
  subheading,
  tea,
  teaId,
}: TeaInfoFormFieldsProps) {
  const [images, setImages] = useState<Array<ImageStoryForm>>(() => initImages(tea));
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
  const errors = state.errors?.properties ?? undefined;
  const imagesError = imageSizeError || state.errors?.properties?.images?.errors.join(" ");

  const onSubmit = (formData: FormData) => {
    const totalSize = images.reduce((acc, curr) => (curr.isNew ? acc + curr.file.size : acc), 0);
    if (totalSize > 2.5 * 1024 * 1024) {
      setImageSizeError("El tamaño total de las imágenes es superior al permitido");
      return;
    }
    setImageSizeError("");
    images.forEach((img) => {
      if (img.isNew) {
        formData.append("images", img.file);
        formData.append("images_order", img.order.toString());
      } else {
        formData.append("kept_images", img.id);
        formData.append("kept_images_order", img.order.toString());
      }
    });
    if (teaId) {
      formData.append("tea_id", teaId);
    }
    action(formData);
  };

  return (
    <div className="card w-full mx-10 bg-base-100 shadow-xl mt-10 mb-10 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-10 before:pointer-events-none">
      <Form action={onSubmit} className="card-body">
        <h2 className="card-title">{heading}</h2>
        {greeting && <p>{greeting}</p>}
        {subheading && <p className="text-sm">{subheading}</p>}
        <div className="items-center mt-2">
          <div className="divider divider-neutral">Info del té</div>

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <BsCupHotFill />
            <input
              className="grow"
              defaultValue={state.inputs?.teaName ?? tea?.name}
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
                defaultValue={state.inputs?.temperature ?? tea?.temperature}
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
                defaultValue={state.inputs?.infusionTime ?? tea?.infusionTime}
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
                defaultChecked={state.inputs?.hasTheine ?? tea?.hasTheine}
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
                defaultChecked={state.inputs?.addMilk ?? tea?.addMilk}
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
                defaultChecked={state.inputs?.canReinfuse ?? tea?.canReinfuse}
                name="canReinfuse"
                type="checkbox"
              />
            </label>
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaRepeat />
              <input
                className="grow"
                defaultValue={state.inputs?.reinfuseNumber ?? tea?.reinfuseNumber ?? undefined}
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
              defaultValue={state.inputs?.moreIndications ?? tea?.moreIndications ?? ""}
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
              defaultValue={state.inputs?.storeName ?? tea?.storeName ?? ""}
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
              defaultValue={state.inputs?.urlStore ?? tea?.url ?? ""}
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
            defaultValue={state.inputs?.storyPart1 ?? tea?.story?.storyPart1 ?? ""}
            name="storyPart1"
            placeholder="Historia: parte 1"
          />
          <label className="label">Parte 2 (13:00 h)</label>
          <textarea
            className="textarea w-full"
            defaultValue={state.inputs?.storyPart2 ?? tea?.story?.storyPart2 ?? ""}
            name="storyPart2"
            placeholder="Historia: parte 2"
          />
          <label className="label">Parte 3 (18:00 h)</label>
          <textarea
            className="textarea w-full"
            defaultValue={state.inputs?.storyPart3 ?? tea?.story?.storyPart3 ?? ""}
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
                defaultValue={state.inputs?.youtubeURL ?? tea?.story?.youtubeURL ?? ""}
                name="youtubeURL"
                placeholder="Enlace de youtube a video o música"
                type="text"
              />
            </label>
            <label className="label flex justify-center items-center">
              ¿Sólo música?
              <input
                className="checkbox"
                defaultChecked={state.inputs?.onlyMusic ?? tea?.story?.onlyMusic ?? false}
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
            {isPending ? <span className="loading loading-spinner"></span> : tea ? "EdiTélo" : "Añadirlo"}
          </button>
        </div>
      </Form>
    </div>
  );
}
export default TeaInfoForm;
