"use client";
import { cn } from "cn";
import { ChevronDown, Sun, Sunrise, Sunset } from "lucide-react";
import Form from "next/form";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import type { Prisma } from "@/generated/prisma/client";

import TeaListImageForm, { TeaListImageFormHandle, toImagesBudgetError } from "@/components/tea/TeaListImageForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { showActionToast } from "@/lib/action-toast";
import { HOURS, toHourLabel } from "@/lib/advientea-rules";
import { MAX_NEW_IMAGES_BYTES, toMegabytesLabel } from "@/lib/image-budget";
import { ImageStoryForm, initialTeaInfoActionResponse, TeaInfoActionResponse } from "@/lib/types";

type TeaWithStoryImages = Prisma.TeaGetPayload<{ include: { story: { include: { images: true } } } }>;

interface TeaInfoFormProps {
  action: (prevState: null | TeaInfoActionResponse, formData: FormData) => Promise<TeaInfoActionResponse>;
  /** A line above the day, such as the guest's greeting. */
  greeting?: string;
  heading: string;
  subheading?: string;
  /** The label of the save button; "Guardar mi té" unless someone else's tea is being edited. */
  submitLabel?: string;
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

const STORY_PARTS = [
  { hour: HOURS.PART1, icon: Sunrise, label: "Parte 1", name: "storyPart1" },
  { hour: HOURS.PART2, icon: Sun, label: "Parte 2", name: "storyPart2" },
  { hour: HOURS.PART3, icon: Sunset, label: "Parte 3", name: "storyPart3" },
] as const;

function RequiredMark() {
  return (
    <span aria-hidden="true" className="-ml-1 text-muted-foreground">
      *
    </span>
  );
}

interface SwitchFieldProps {
  checked: boolean;
  description?: string;
  /** The id of the element that shows this switch's error, when it has one. */
  errorId?: string;
  id: string;
  label: string;
  name: string;
  onCheckedChange: (checked: boolean) => void;
}

/**
 * A labelled switch that submits "true" or "false" through its own hidden input. The switch's built-in input is
 * controlled by Base UI, and React's reset after a form action would turn it back to its first value while the
 * switch still shows the last one.
 */
function SwitchField({ checked, description, errorId, id, label, name, onCheckedChange }: SwitchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  // The reset after a form action also unchecks the built-in input behind the switch's back, and the next
  // click would then only bring it back to the state already shown. Runs after every commit, the reset's too.
  useLayoutEffect(() => {
    if (inputRef.current && inputRef.current.checked !== checked) {
      inputRef.current.checked = checked;
    }
  });
  return (
    <FieldLabel htmlFor={id}>
      <Field data-invalid={!!errorId || undefined} orientation="horizontal">
        <FieldContent>
          <FieldTitle>{label}</FieldTitle>
          {description && <FieldDescription>{description}</FieldDescription>}
        </FieldContent>
        <Switch
          aria-describedby={errorId}
          aria-invalid={errorId ? true : undefined}
          checked={checked}
          id={id}
          inputRef={inputRef}
          onCheckedChange={onCheckedChange}
        />
        <input name={name} type="hidden" value={checked ? "true" : "false"} />
      </Field>
    </FieldLabel>
  );
}

interface OptionalSectionProps {
  children: React.ReactNode;
  description?: string;
  /** Whether the section already holds something; it then starts open on phones. */
  hasContent: boolean;
  /** A section with errors stays open, so the errors can be seen. */
  hasErrors: boolean;
  title: string;
}

/** A section the participant may skip: collapsible on phones, always open from `sm` up. */
function OptionalSection({ children, description, hasContent, hasErrors, title }: OptionalSectionProps) {
  const [open, setOpen] = useState(hasContent || hasErrors);
  // Opened for good rather than only while the errors last: fixing the last one must not fold the section
  // away under the user, along with the focus.
  if (hasErrors && !open) {
    setOpen(true);
  }
  const titleContent = (
    <>
      {title} <span className="text-sm font-normal text-muted-foreground">(opcional)</span>
    </>
  );
  return (
    <Collapsible
      onOpenChange={(nextOpen) => setOpen(nextOpen || hasErrors)}
      open={open}
      render={<FieldSet className="gap-5" />}
    >
      {/* A legend is not a flex item, so the gap after it comes from its own margin. */}
      <FieldLegend className={cn("w-full", description ? "mb-1" : "mb-3")}>
        <h2 className="text-lg font-semibold">
          <span className="hidden sm:inline">{titleContent}</span>
          <CollapsibleTrigger className="group/trigger flex min-h-11 w-full items-center justify-between gap-3 rounded-xl text-left outline-none focus-visible:focus-ring sm:hidden">
            <span>{titleContent}</span>
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
        </h2>
      </FieldLegend>
      {/* Kept mounted so its fields are always submitted; hidden only below `sm`, where the trigger shows. */}
      <CollapsibleContent
        keepMounted
        render={(props, state) => (
          <div
            {...props}
            className={cn("flex flex-col gap-5", props.className, !state.open && "max-sm:hidden")}
            hidden={false}
          />
        )}
      >
        {description && <FieldDescription>{description}</FieldDescription>}
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
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
  submitLabel = "Guardar mi té",
  tea,
  teaId,
}: TeaInfoFormFieldsProps) {
  const { inputs } = state;
  const [images, setImages] = useState<Array<ImageStoryForm>>(() => initImages(tea));
  const [hasTheine, setHasTheine] = useState(inputs?.hasTheine ?? tea?.hasTheine ?? false);
  const [addMilk, setAddMilk] = useState(inputs?.addMilk ?? tea?.addMilk ?? false);
  const [canReinfuse, setCanReinfuse] = useState(inputs?.canReinfuse ?? tea?.canReinfuse ?? false);
  // Kept while "Reinfusiona" is off, so turning it back on brings the count back; only submitted while on.
  const [reinfuseNumber, setReinfuseNumber] = useState(() =>
    String((inputs ? inputs.reinfuseNumber : tea?.reinfuseNumber) ?? ""),
  );
  const [onlyMusic, setOnlyMusic] = useState(inputs?.onlyMusic ?? tea?.story?.onlyMusic ?? false);
  /** The response whose image errors no longer apply, because the images have changed since it came. */
  const [imagesEditedAfter, setImagesEditedAfter] = useState<null | TeaInfoActionResponse>(null);
  const imageListRef = useRef<TeaListImageFormHandle>(null);
  const router = useRouter();
  const id = useId();

  const errors = state.errors?.properties ?? undefined;
  const imagesErrors = errors?.images;
  const serverImagesError =
    imagesEditedAfter === state
      ? ""
      : [...(imagesErrors?.errors ?? []), ...(imagesErrors?.items ?? []).flatMap((item) => item?.errors ?? [])]
          .filter((error, i, all) => all.indexOf(error) === i)
          .join(" ");
  const budgetError = toImagesBudgetError(images);
  const formError = state.errors?.errors.join(" ");
  const submitBlockedId = `${id}-submit-blocked`;

  const updateImages: typeof setImages = (update) => {
    setImagesEditedAfter(state);
    setImages(update);
  };

  const fieldId = (name: string) => `${id}-${name}`;
  const errorOf = (name: keyof NonNullable<typeof errors>) => errors?.[name]?.errors.join(", ") || undefined;
  /** The props that tie a control to its error. */
  const invalidProps = (name: keyof NonNullable<typeof errors>, describedBy?: string) => {
    const error = errorOf(name);
    const ids = [describedBy, error ? `${fieldId(name)}-error` : undefined].filter(Boolean).join(" ");
    return { "aria-describedby": ids || undefined, "aria-invalid": error ? true : undefined };
  };

  // After a failed save the inputs are what was typed: a field left empty there stays empty, whatever was saved.
  const values = inputs
    ? {
        infusionTime: inputs.infusionTime || "",
        moreIndications: inputs.moreIndications ?? "",
        storeName: inputs.storeName ?? "",
        storyPart1: inputs.storyPart1 ?? "",
        storyPart2: inputs.storyPart2 ?? "",
        storyPart3: inputs.storyPart3 ?? "",
        teaName: inputs.teaName ?? "",
        temperature: inputs.temperature || "",
        urlStore: inputs.urlStore ?? "",
        youtubeURL: inputs.youtubeURL ?? "",
      }
    : {
        infusionTime: tea?.infusionTime ?? "",
        moreIndications: tea?.moreIndications ?? "",
        storeName: tea?.storeName ?? "",
        storyPart1: tea?.story?.storyPart1 ?? "",
        storyPart2: tea?.story?.storyPart2 ?? "",
        storyPart3: tea?.story?.storyPart3 ?? "",
        teaName: tea?.name ?? "",
        temperature: tea?.temperature ?? "",
        urlStore: tea?.url ?? "",
        youtubeURL: tea?.story?.youtubeURL ?? "",
      };

  // Stopped before the action starts: React resets the form when an action runs, which would wipe what was typed.
  const blockSubmitIfImagesTooLarge = (event: React.FormEvent<HTMLFormElement>) => {
    if (budgetError) {
      event.preventDefault();
      imageListRef.current?.focusLastNewImage();
    }
  };

  const onSubmit = (formData: FormData) => {
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
    <Card className="mx-auto w-full max-w-2xl shadow-sm [--card-spacing:--spacing(4)] sm:[--card-spacing:--spacing(8)]">
      <CardHeader>
        {greeting && <p className="text-base">{greeting}</p>}
        <CardTitle>
          <h1 className="font-display text-3xl text-balance sm:text-4xl">{heading}</h1>
        </CardTitle>
        {subheading && <CardDescription className="text-base text-foreground">{subheading}</CardDescription>}
      </CardHeader>
      <CardContent>
        <Form action={onSubmit} className="flex flex-col gap-6 sm:gap-8" onSubmit={blockSubmitIfImagesTooLarge}>
          <FieldSet className="gap-5">
            <FieldLegend className="mb-0">
              <h2 className="text-lg font-semibold">El té</h2>
            </FieldLegend>
            <FieldDescription className="-mt-3">Los campos con * son obligatorios.</FieldDescription>

            <Field data-invalid={!!errorOf("teaName") || undefined}>
              <FieldLabel htmlFor={fieldId("teaName")}>
                Nombre del té <RequiredMark />
              </FieldLabel>
              <Input
                {...invalidProps("teaName")}
                autoComplete="off"
                defaultValue={values.teaName}
                id={fieldId("teaName")}
                name="teaName"
                required
                type="text"
              />
              <FieldError id={`${fieldId("teaName")}-error`}>{errorOf("teaName")}</FieldError>
            </Field>

            <div className="grid grid-cols-2 items-start gap-3 sm:gap-5">
              <Field data-invalid={!!errorOf("temperature") || undefined}>
                <FieldLabel htmlFor={fieldId("temperature")}>
                  Temperatura <span className="sr-only">en grados</span>
                  <RequiredMark />
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...invalidProps("temperature")}
                    defaultValue={values.temperature}
                    id={fieldId("temperature")}
                    inputMode="numeric"
                    max={150}
                    min={30}
                    name="temperature"
                    required
                    type="number"
                  />
                  <InputGroupAddon align="inline-end">°C</InputGroupAddon>
                </InputGroup>
                <FieldError id={`${fieldId("temperature")}-error`}>{errorOf("temperature")}</FieldError>
              </Field>

              <Field data-invalid={!!errorOf("infusionTime") || undefined}>
                <FieldLabel htmlFor={fieldId("infusionTime")}>
                  Tiempo <span className="sr-only">de infusión en minutos</span>
                  <RequiredMark />
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...invalidProps("infusionTime")}
                    defaultValue={values.infusionTime}
                    id={fieldId("infusionTime")}
                    inputMode="numeric"
                    max={30}
                    min={1}
                    name="infusionTime"
                    required
                    type="number"
                  />
                  <InputGroupAddon align="inline-end">min</InputGroupAddon>
                </InputGroup>
                <FieldError id={`${fieldId("infusionTime")}-error`}>{errorOf("infusionTime")}</FieldError>
              </Field>
            </div>

            <div className="flex flex-col gap-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <SwitchField
                  checked={hasTheine}
                  errorId={errorOf("hasTheine") && `${fieldId("hasTheine")}-error`}
                  id={fieldId("hasTheine")}
                  label="Tiene teína"
                  name="hasTheine"
                  onCheckedChange={setHasTheine}
                />
                <SwitchField
                  checked={addMilk}
                  errorId={errorOf("addMilk") && `${fieldId("addMilk")}-error`}
                  id={fieldId("addMilk")}
                  label="Con leche"
                  name="addMilk"
                  onCheckedChange={setAddMilk}
                />
                <SwitchField
                  checked={canReinfuse}
                  errorId={errorOf("canReinfuse") && `${fieldId("canReinfuse")}-error`}
                  id={fieldId("canReinfuse")}
                  label="Reinfusiona"
                  name="canReinfuse"
                  onCheckedChange={setCanReinfuse}
                />
              </div>
              {(["hasTheine", "addMilk", "canReinfuse"] as const).map((name) => (
                <FieldError id={`${fieldId(name)}-error`} key={name}>
                  {errorOf(name)}
                </FieldError>
              ))}
            </div>

            {canReinfuse && (
              <Field className="sm:w-[calc(50%-0.625rem)]" data-invalid={!!errorOf("reinfuseNumber") || undefined}>
                <FieldLabel htmlFor={fieldId("reinfuseNumber")}>¿Cuántas veces?</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...invalidProps("reinfuseNumber")}
                    id={fieldId("reinfuseNumber")}
                    inputMode="numeric"
                    min={1}
                    name="reinfuseNumber"
                    onChange={(event) => setReinfuseNumber(event.target.value)}
                    type="number"
                    value={reinfuseNumber}
                  />
                  <InputGroupAddon align="inline-end">veces</InputGroupAddon>
                </InputGroup>
                <FieldError id={`${fieldId("reinfuseNumber")}-error`}>{errorOf("reinfuseNumber")}</FieldError>
              </Field>
            )}

            <Field data-invalid={!!errorOf("moreIndications") || undefined}>
              <FieldLabel htmlFor={fieldId("moreIndications")}>
                Más indicaciones <span className="font-normal text-muted-foreground">(opcional)</span>
              </FieldLabel>
              <Input
                {...invalidProps("moreIndications")}
                defaultValue={values.moreIndications}
                id={fieldId("moreIndications")}
                name="moreIndications"
                placeholder="Por ejemplo: sin azúcar"
                type="text"
              />
              <FieldError id={`${fieldId("moreIndications")}-error`}>{errorOf("moreIndications")}</FieldError>
            </Field>
          </FieldSet>

          <FieldSeparator />

          <OptionalSection
            hasContent={!!(values.storeName || values.urlStore)}
            hasErrors={!!(errorOf("storeName") || errorOf("urlStore"))}
            title="Dónde comprarlo"
          >
            <div className="grid items-start gap-5 sm:grid-cols-2">
              <Field data-invalid={!!errorOf("storeName") || undefined}>
                <FieldLabel htmlFor={fieldId("storeName")}>Tienda</FieldLabel>
                <Input
                  {...invalidProps("storeName")}
                  defaultValue={values.storeName}
                  id={fieldId("storeName")}
                  name="storeName"
                  type="text"
                />
                <FieldError id={`${fieldId("storeName")}-error`}>{errorOf("storeName")}</FieldError>
              </Field>
              <Field data-invalid={!!errorOf("urlStore") || undefined}>
                <FieldLabel htmlFor={fieldId("urlStore")}>Web de la tienda</FieldLabel>
                <Input
                  {...invalidProps("urlStore")}
                  defaultValue={values.urlStore}
                  id={fieldId("urlStore")}
                  inputMode="url"
                  name="urlStore"
                  placeholder="https://"
                  type="text"
                />
                <FieldError id={`${fieldId("urlStore")}-error`}>{errorOf("urlStore")}</FieldError>
              </Field>
            </div>
          </OptionalSection>

          <FieldSeparator />

          <OptionalSection
            description="No hace falta rellenarlo todo: solo lo que te apetezca o hayas podido preparar."
            hasContent={
              !!(values.storyPart1 || values.storyPart2 || values.storyPart3 || values.youtubeURL) || images.length > 0
            }
            hasErrors={
              !!(
                errorOf("storyPart1") ||
                errorOf("storyPart2") ||
                errorOf("storyPart3") ||
                errorOf("youtubeURL") ||
                errorOf("onlyMusic") ||
                serverImagesError ||
                budgetError
              )
            }
            title="Ambientación"
          >
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">Historia</h3>
                <FieldDescription>Se cuenta en tres partes a lo largo del día.</FieldDescription>
              </div>
              <ol className="flex flex-col">
                {STORY_PARTS.map(({ hour, icon: Icon, label, name }, i) => (
                  <li className="grid grid-cols-[2.25rem_1fr] gap-x-3" key={name}>
                    <div aria-hidden="true" className="flex flex-col items-center">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground">
                        <Icon className="size-4" />
                      </span>
                      {i < STORY_PARTS.length - 1 && <span className="my-1 w-px flex-1 bg-foreground/25" />}
                    </div>
                    <Field
                      className={cn("gap-2", i < STORY_PARTS.length - 1 && "pb-5")}
                      data-invalid={!!errorOf(name) || undefined}
                    >
                      <div className="flex min-h-9 flex-col justify-center gap-0.5">
                        <FieldLabel htmlFor={fieldId(name)}>{label}</FieldLabel>
                        <FieldDescription id={`${fieldId(name)}-hour`}>
                          Se revela a las {toHourLabel(hour)}
                        </FieldDescription>
                      </div>
                      <Textarea
                        {...invalidProps(name, `${fieldId(name)}-hour`)}
                        className="min-h-24"
                        defaultValue={values[name]}
                        id={fieldId(name)}
                        name={name}
                      />
                      <FieldError id={`${fieldId(name)}-error`}>{errorOf(name)}</FieldError>
                    </Field>
                  </li>
                ))}
              </ol>
            </div>

            <div className="grid items-start gap-3 sm:grid-cols-[1fr_auto] sm:gap-5">
              <Field data-invalid={!!errorOf("youtubeURL") || undefined}>
                <FieldLabel htmlFor={fieldId("youtubeURL")}>Vídeo o música de YouTube</FieldLabel>
                <Input
                  {...invalidProps("youtubeURL", `${fieldId("youtubeURL")}-hour`)}
                  defaultValue={values.youtubeURL}
                  id={fieldId("youtubeURL")}
                  inputMode="url"
                  name="youtubeURL"
                  placeholder="https://youtu.be/"
                  type="text"
                />
                <FieldDescription id={`${fieldId("youtubeURL")}-hour`}>
                  Se ve a partir de las {toHourLabel(HOURS.PART1)}.
                </FieldDescription>
                <FieldError id={`${fieldId("youtubeURL")}-error`}>{errorOf("youtubeURL")}</FieldError>
              </Field>
              <div className="flex flex-col gap-2 sm:pt-6">
                <SwitchField
                  checked={onlyMusic}
                  errorId={errorOf("onlyMusic") && `${fieldId("onlyMusic")}-error`}
                  id={fieldId("onlyMusic")}
                  label="Solo música"
                  name="onlyMusic"
                  onCheckedChange={setOnlyMusic}
                />
                <FieldError id={`${fieldId("onlyMusic")}-error`}>{errorOf("onlyMusic")}</FieldError>
              </div>
            </div>

            <TeaListImageForm
              error={serverImagesError}
              hourLabel={toHourLabel(HOURS.PART1)}
              images={images}
              ref={imageListRef}
              setImages={updateImages}
            />
          </OptionalSection>

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          {budgetError && (
            <p className="text-sm text-destructive" id={submitBlockedId}>
              No se puede guardar hasta que las imágenes nuevas pesen {toMegabytesLabel(MAX_NEW_IMAGES_BYTES)} MB o
              menos.
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button onClick={() => router.back()} size="lg" type="button" variant="outline">
              Cancelar
            </Button>
            <Button
              aria-describedby={budgetError ? submitBlockedId : undefined}
              disabled={isPending}
              size="lg"
              type="submit"
            >
              {isPending && <Spinner data-icon="inline-start" />}
              {submitLabel}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}
export default TeaInfoForm;
