"use client";
import { submitTeaGuess } from "@/app/actions/teaGuessActions";
import { initialTeaGuessActionResponse, SelectOption } from "@/lib/types";
import Form from "next/form";
import { useActionState, useState } from "react";

interface TeaGuessFormProps {
  dayId: string;
  users: Array<SelectOption>;
  teaHasIngredients: boolean;
  ingredients: Array<SelectOption>;
  teaTypeOptions: Array<SelectOption>;
  canUserGuessTea: boolean;
  canUserGuessPerson: boolean;
}

export default function TeaGuessForm({ dayId, teaHasIngredients, ingredients, teaTypeOptions, users, canUserGuessTea, canUserGuessPerson }: TeaGuessFormProps) {
  const [state, action, isPending] = useActionState(submitTeaGuess.bind(null, dayId), initialTeaGuessActionResponse);
  const [ingredientsFormdata, setIngredientsFormdata] = useState<Array<SelectOption>>([]);

  return (
    <Form className="w-full flex flex-col gap-2" action={action}>
      {/* personName */}
      {canUserGuessPerson && (
        <>
          <label className="floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label bg-base-200">Persona proponenTé</span>
            {/* <FaUser /> */}
            <select defaultValue="" className="select select-bordered bg-base-200 w-full" name="personName">
              <option value="" disabled={true}>Elige un nombre</option>
              {users.map((user, index) => (
                <option key={index} value={user.name}>{user.name}</option>
              ))}
            </select>
          </label>
          {state?.errors?.properties?.personName && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.personName.errors.join(" ")}</p>
          )}
        </>
      )}
      {/* teaName */}
      {canUserGuessTea && (
        <>
          <label className="input input-bordered bg-base-200 floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label bg-base-200">Nombre del té</span>
            {/* <FaUser /> */}
            <input
              type="text"
              name="teaName"
              className="w-full"
              placeholder="Nombre del té"
              autoComplete="additional-name"
              defaultValue={state.inputs?.teaName ?? ""}
            />
          </label>
          {state?.errors?.properties?.teaName && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.teaName.errors.join(" ")}</p>
          )}
          {/* teaType */}
          <label className="floating-label flex items-center gap-2 mb-2 w-full">
            <span className="floating-label bg-base-200">Tipo de Té</span>
            {/* <FaUser /> */}
            <select defaultValue="" className="select select-bordered bg-base-200 w-full" name="teaType">
              <option value="" disabled={true}>Elige un tipo</option>
              {teaTypeOptions.map((type) => (
                <option key={type.id} value={type.id}>{type.name}</option>
              ))}
            </select>
          </label>
          {state?.errors?.properties?.teaType && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.teaType.errors.join(" ")}</p>
          )}
          {/* ingredients */}
          {/* {!teaHasIngredients && (
            <>
              <label className="floating-label flex items-center gap-2 mb-2 w-full">
                <span className="floating-label">IngredienTés</span>
                <select defaultValue="" className="select w-full" name={`ingredient-${ingredientsFormdata.length + 1}`}>
                  <option value="" disabled={true}>Elige un ingrediente</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>
                  ))}
                </select>
              </label>
              {state?.errors?.properties?.ingredients && (
                <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.properties.ingredients.errors.join(" ")}</p>
              )}
            </>
          )} */}
        </>
      )}
      {!state.success && state.message && <p className="text-xs text-error font-bold text-center mb-2">{state.message}</p>}
      <div className="card-actions justify-center mt-4 gap-2">
        <button className="btn btn-primary" type="submit" disabled={isPending}>
          {isPending ? <span className="loading loading-spinner"></span> : "AdivinaTé"}
        </button>
      </div>
    </Form>
  );
}
