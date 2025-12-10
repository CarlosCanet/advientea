"use client";
import { ImageStoryForm, initialTeaInfoActionResponse } from "@/lib/types";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { BsCupHotFill } from "react-icons/bs";
import { FaCalendar, FaClock,  FaInfoCircle,  FaStore, FaUser } from "react-icons/fa";
import { FaMusic, FaRepeat, FaTemperatureFull } from "react-icons/fa6";
import { MdComputer, MdMore } from "react-icons/md";
import { SiUndertale } from "react-icons/si";
import { addTeaInfo } from "@/app/actions/teaInfoActions";
import WaitForDayAssignment from "./ui/WaitForDayAssignment";
import TeaListImageForm from "./ui/TeaListImageForm";

interface AddTeaInfoFormProps {
  username: string,
  dayNumber: number,
  isLoggedIn: boolean,
  canAssign: boolean,
  users: string[]
}

function AddTeaInfoForm({ username, dayNumber, isLoggedIn, canAssign, users }: AddTeaInfoFormProps) {
  const [state, action, isPending] = useActionState(addTeaInfo, initialTeaInfoActionResponse);
  const [images, setImages] = useState<ImageStoryForm[]>([]);
  const [imageSizeError, setImageSizeError] = useState<string>("");
  const router = useRouter();
  useEffect(() => {
    return () => {
      images.forEach(img => {
        if (img.isNew) {
          URL.revokeObjectURL(img.previewURL)
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
    const totalSize = images.reduce((acc, curr) => curr.isNew ? acc + curr.file.size : acc, 0);
    if (totalSize > 2.5 * 1024 * 1024) {
      setImageSizeError("El tamaño total de las imágenes es superior al permitido");
      return;
    }
    images.forEach(img => {
      if (img.isNew) {
        formData.append("images", img.file);
      } else {
        formData.append("kept_images", img.publicId);
      }
    })
    action(formData);
  }

  if (isLoggedIn && !canAssign && (dayNumber <= 0 || dayNumber > 25)) {
    return (
      <WaitForDayAssignment />
    );
  }
  
  return (
    <div className="card w-full mx-10 bg-base-100 shadow-xl mt-10 mb-10 before:content-[''] before:absolute before:inset-0 before:bg-[url('/BackgroundSemiCircleLeaves.svg')] before:bg-no-repeat before:opacity-10 before:pointer-events-none">
      <Form className="card-body" action={onSubmit}>
        <h2 className="card-title"><div>Añadir<span className="italic">Té</span></div></h2>
        <div className="items-center mt-2">
          <label className="label justify-center text-center w-full mb-2"><FaInfoCircle />El día se pone automáticamente</label>
          <div className="flex gap-2">
            {canAssign ? (
              <select defaultValue={`Elige a une persone`} className="select" name="personName">
                <option disabled={true}>Elige a une persone</option>
                {users.map((user, i) => <option key={`${user}-${i}`}>{user}</option>)}
              </select>
            ) : (
              <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
                <FaUser />
                <input type="text" name="personName" className="grow" placeholder="Nombre de la persona" required defaultValue={state.inputs?.personName ?? username} readOnly={isLoggedIn} />
              </label>
            )}
            {errors?.personName && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.personName.errors.join(", ")}</p>}
            <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
              <FaCalendar />
              <input type="text" name="dayNumber" className="grow" placeholder="Día asignado" required min={0} defaultValue={state.inputs?.dayNumber ?? dayNumber} readOnly />
            </label>
            {errors?.dayNumber && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.dayNumber.errors.join(", ")}</p>}
          </div>
          
          <div className="divider divider-neutral">Info del té</div>
          
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <BsCupHotFill />
            <input type="text" name="teaName" className="grow" placeholder="Nombre del té" required defaultValue={state.inputs?.teaName} />
          </label>
          {errors?.teaName && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.teaName.errors.join(", ")}</p>}
          <div className="flex gap-2">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaTemperatureFull />
              <input type="number" name="temperature" className="grow" placeholder="Temperatura" required min={30} max={150} defaultValue={state.inputs?.temperature}/>
            </label>
            {errors?.temperature && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.temperature.errors.join(", ")}</p>}
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaClock />
              <input type="number" name="infusionTime" className="grow" placeholder="Tiempo de infusión" required min={1} max={30} defaultValue={state.inputs?.infusionTime} />
            </label>
            {errors?.infusionTime && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.infusionTime.errors.join(", ")}</p>}
          </div>
          <div className="flex gap-2 my-2 py-2">
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Tiene teína?
              <input type="checkbox" name="hasTheine" className="checkbox" defaultChecked={state.inputs?.hasTheine} />
            </label>
            {errors?.hasTheine && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.hasTheine.errors.join(", ")}</p>}
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Con leche?
              <input type="checkbox" name="addMilk" className="checkbox" defaultChecked={state.inputs?.addMilk}/>
            </label>
            {errors?.addMilk && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.addMilk.errors.join(", ")}</p>}
          </div>
          <div className="flex gap-2 my-2">
            <label className="label flex justify-center items-center mx-2 w-full">
              ¿Reinfusiona?
              <input type="checkbox" name="canReinfuse" className="checkbox" defaultChecked={state.inputs?.canReinfuse} />
            </label>
            <label className="input input-bordered flex items-center gap-2 w-full">
              <FaRepeat />
              <input type="number" name="reinfuseNumber" className="grow" placeholder="¿Cuántas veces?" min={0} defaultValue={state.inputs?.reinfuseNumber} />
            </label>
          </div>
          {errors?.canReinfuse && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.canReinfuse.errors.join(", ")}</p>}
          {errors?.reinfuseNumber && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.reinfuseNumber.errors.join(", ")}</p>}
          
          <div className="divider">Opcional</div>
          
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdMore />
            <input type="text" name="moreIndications" className="grow" placeholder="Más indicaciones" defaultValue={state.inputs?.moreIndications}/>
          </label>
          {errors?.moreIndications && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.moreIndications.errors.join(", ")}</p>}
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <FaStore />
            <input type="text" name="storeName" className="grow" placeholder="Nombre de la tienda" defaultValue={state.inputs?.storeName} />
          </label>
          {errors?.storeName && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.storeName.errors.join(", ")}</p>}
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdComputer />
            <input type="text" name="urlStore" className="grow" placeholder="Web de la tienda" defaultValue={state.inputs?.urlStore} />
          </label>
          {errors?.urlStore && <p className="text-xs text-error font-bold -mt-2 mb-2">{errors.urlStore.errors.join(", ")}</p>}
        </div>
        
        <div className="divider divider-neutral">Ambientación</div>
        
        <label className="label justify-center text-center">No tienes que rellenar toda la ambientación, <br />sólo lo que te interese o hayas podido</label>
        <fieldset className="fieldset">
          <legend className="fieldset-legend"><SiUndertale /> Historia</legend>  
          <label className="label">Parte 1 (07:00 h)</label>
          <textarea name="storyPart1" className="textarea w-full" placeholder="Historia: parte 1" defaultValue={state.inputs?.storyPart1} />
          <label className="label">Parte 2 (13:00 h)</label>
          <textarea name="storyPart2" className="textarea w-full" placeholder="Historia: parte 2" defaultValue={state.inputs?.storyPart2} />
          <label className="label">Parte 3 (18:00 h)</label>
          <textarea name="storyPart3" className="textarea w-full" placeholder="Historia: parte 3" defaultValue={state.inputs?.storyPart3} />
        </fieldset>
        <fieldset className="fieldset">
          <legend className="fieldset-legend"><FaMusic /> Vídeo o música (07:00 h)</legend>
          <div className="flex gap-2 items-center">
            <label className="input input-bordered flex items-center gap-2 w-full">
              <input type="text" name="youtubeURL" className="grow" placeholder="Enlace de youtube a video o música" defaultValue={state.inputs?.youtubeURL} />
            </label>
            <label className="label flex justify-center items-center">
              ¿Sólo música?
              <input type="checkbox" name="onlyMusic" className="checkbox" defaultChecked={state.inputs?.onlyMusic} />
            </label>
          </div>
          {errors?.youtubeURL && <p className="text-xs text-error font-bold mt-2 mb-2">{errors.youtubeURL.errors.join(", ")}</p>}
          {errors?.onlyMusic && <p className="text-xs text-error font-bold mt-2 mb-2">{errors.onlyMusic.errors.join(", ")}</p>}
        </fieldset>
        <TeaListImageForm images={images} setImages={setImages} />
        {imagesError && <p className="text-xs text-error font-bold self-center -mt-2 mb-2">{imagesError}</p>}

        <div className="card-actions justify-center mt-4 gap-2">
          <button className="btn btn-error" onClick={() => router.back()}>Cancelar</button>
          <button className="btn btn-primary" type="submit" disabled={isPending}>
            {isPending ? <span className="loading loading-spinner"></span> : "Añadirlo"}
          </button>
        </div>
      </Form>
    </div>
  );
}
export default AddTeaInfoForm;