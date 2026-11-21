"use client";
import Form from "next/form";
import { useActionState, useEffect, useId, useState } from "react";

import { submitTeaGuess } from "@/app/actions/teaGuessActions";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { showActionToast } from "@/lib/action-toast";
import { initialTeaGuessActionResponse, SelectOption } from "@/lib/types";

interface TeaGuessFormProps {
  canUserGuessPerson: boolean;
  canUserGuessTea: boolean;
  dayId: string;
  ingredients: Array<SelectOption>;
  teaHasIngredients: boolean;
  teaTypeOptions: Array<SelectOption>;
  users: Array<SelectOption>;
}

export default function TeaGuessForm({
  canUserGuessPerson,
  canUserGuessTea,
  dayId,
  ingredients,
  teaHasIngredients,
  teaTypeOptions,
  users,
}: TeaGuessFormProps) {
  const [state, action, isPending] = useActionState(submitTeaGuess.bind(null, dayId), initialTeaGuessActionResponse);
  const [ingredientsFormdata, setIngredientsFormdata] = useState<Array<SelectOption>>([]);
  const fieldId = useId();
  // Controlled, because React resets the form after the action and a failed guess must keep what was typed.
  const [personName, setPersonName] = useState<null | string>(state.inputs?.personName || null);
  const [teaName, setTeaName] = useState(state.inputs?.teaName ?? "");
  const [teaType, setTeaType] = useState<null | string>(state.inputs?.teaType || null);
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.success) {
      setPersonName(null);
      setTeaName("");
      setTeaType(null);
    }
  }
  useEffect(() => {
    if (state.message) {
      showActionToast(state);
    }
  }, [state]);

  const personNameErrors = state?.errors?.properties?.personName?.errors;
  const teaNameErrors = state?.errors?.properties?.teaName?.errors;
  const teaTypeErrors = state?.errors?.properties?.teaType?.errors;
  const formErrors = state?.errors?.errors;

  return (
    <Form action={action} className="flex w-full flex-col gap-4">
      {/* personName */}
      {canUserGuessPerson && (
        <Field data-invalid={personNameErrors ? true : undefined}>
          <FieldLabel htmlFor={`${fieldId}-personName`}>Persona proponenTé</FieldLabel>
          <Select
            items={users.map((user) => ({ label: user.name, value: user.name }))}
            name="personName"
            onValueChange={(value) => setPersonName(value)}
            value={personName}
          >
            <SelectTrigger
              aria-describedby={personNameErrors ? `${fieldId}-personName-error` : undefined}
              aria-invalid={personNameErrors ? true : undefined}
              className="w-full bg-popover"
              id={`${fieldId}-personName`}
            >
              <SelectValue placeholder="Elige un nombre" />
            </SelectTrigger>
            <SelectContent>
              {users.map((user, index) => (
                <SelectItem key={index} value={user.name}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError id={`${fieldId}-personName-error`}>{personNameErrors?.join(" ")}</FieldError>
        </Field>
      )}
      {/* teaName */}
      {canUserGuessTea && (
        <>
          <Field data-invalid={teaNameErrors ? true : undefined}>
            <FieldLabel htmlFor={`${fieldId}-teaName`}>Nombre del té</FieldLabel>
            <Input
              aria-describedby={teaNameErrors ? `${fieldId}-teaName-error` : undefined}
              aria-invalid={teaNameErrors ? true : undefined}
              autoComplete="off"
              className="bg-popover"
              id={`${fieldId}-teaName`}
              name="teaName"
              onChange={(event) => setTeaName(event.target.value)}
              placeholder="Nombre del té"
              type="text"
              value={teaName}
            />
            <FieldError id={`${fieldId}-teaName-error`}>{teaNameErrors?.join(" ")}</FieldError>
          </Field>
          {/* teaType */}
          <Field data-invalid={teaTypeErrors ? true : undefined}>
            <FieldLabel htmlFor={`${fieldId}-teaType`}>Tipo de Té</FieldLabel>
            <Select
              items={teaTypeOptions.map((type) => ({ label: type.name, value: type.id }))}
              name="teaType"
              onValueChange={(value) => setTeaType(value)}
              value={teaType}
            >
              <SelectTrigger
                aria-describedby={teaTypeErrors ? `${fieldId}-teaType-error` : undefined}
                aria-invalid={teaTypeErrors ? true : undefined}
                className="w-full bg-popover"
                id={`${fieldId}-teaType`}
              >
                <SelectValue placeholder="Elige un tipo" />
              </SelectTrigger>
              <SelectContent>
                {teaTypeOptions.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id={`${fieldId}-teaType-error`}>{teaTypeErrors?.join(" ")}</FieldError>
          </Field>
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
      {formErrors && formErrors.length > 0 && (
        <p className="text-center text-sm text-destructive" role="alert">
          {formErrors.join(" ")}
        </p>
      )}
      <div className="mt-2 flex justify-center">
        <Button className="min-w-36" disabled={isPending} size="lg" type="submit">
          {isPending && <Spinner data-icon="inline-start" />}
          AdivinaTé
        </Button>
      </div>
    </Form>
  );
}
