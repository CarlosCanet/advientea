"use client";
import { ChevronDown, Eye, EyeOff, KeyRound, User } from "lucide-react";
import { CldImage } from "next-cloudinary";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useRef, useState } from "react";

import { updateUserProfile } from "@/app/actions/authActions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { showActionToast } from "@/lib/action-toast";
import { MAX_AVATAR_BYTES, toMegabytesLabel } from "@/lib/image-budget";
import { ALLOWED_IMAGE_TYPES, initialUpdateProfileActionResponse, UpdateProfileActionResponse } from "@/lib/types";

interface ProfileFormProps {
  email: string;
  imageId: string;
  username: string;
}

const BACK_FALLBACK_HREF = "/";
const MAX_AVATAR_LABEL = `${toMegabytesLabel(MAX_AVATAR_BYTES)}\u00a0MB`;
/** TypeScript's DOM library does not declare the Navigation API yet. */
type WindowWithNavigation = Window & { navigation?: { canGoBack: boolean } };

const PASSWORD_FIELDS = ["currentPassword", "newPassword", "newPasswordConfirmation"] as const;

function hasPasswordErrors(state: UpdateProfileActionResponse) {
  return PASSWORD_FIELDS.some((name) => !!state.errors?.properties?.[name]);
}

function toAvatarError(file: File): string {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Formato no permitido: elige una imagen JPG, PNG, GIF o WebP.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return `La imagen pesa ${toMegabytesLabel(file.size)}\u00a0MB y el máximo es ${MAX_AVATAR_LABEL}.`;
  }
  return "";
}

interface PasswordFieldProps {
  autoComplete: "current-password" | "new-password";
  disabled: boolean;
  error?: string;
  id: string;
  label: string;
  name: (typeof PASSWORD_FIELDS)[number];
  onChange: (value: string) => void;
  required: boolean;
  toggle?: { controls: string; label: string; onToggle: () => void };
  value: string;
  visible: boolean;
}

function PasswordField({
  autoComplete,
  disabled,
  error,
  id,
  label,
  name,
  onChange,
  required,
  toggle,
  value,
  visible,
}: PasswordFieldProps) {
  return (
    <Field data-invalid={!!error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          aria-describedby={error ? `${id}-error` : undefined}
          aria-invalid={!!error || undefined}
          autoComplete={autoComplete}
          disabled={disabled}
          id={id}
          name={name}
          onChange={(event) => onChange(event.target.value)}
          required={required}
          type={visible ? "text" : "password"}
          value={value}
        />
        <InputGroupAddon>
          <KeyRound />
        </InputGroupAddon>
        {toggle && (
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              aria-controls={toggle.controls}
              aria-label={toggle.label}
              aria-pressed={visible}
              disabled={disabled}
              onClick={toggle.onToggle}
              size="icon-xs"
            >
              {visible ? <EyeOff /> : <Eye />}
            </InputGroupButton>
          </InputGroupAddon>
        )}
      </InputGroup>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

export default function ProfileForm({ email, imageId, username: savedUsername }: ProfileFormProps) {
  const [state, action, isPending] = useActionState(updateUserProfile, initialUpdateProfileActionResponse);
  // Controlled, so React's reset after the action keeps what was typed even when the response brings no inputs.
  const [username, setUsername] = useState(savedUsername);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [imagePreviewURL, setImagePreviewURL] = useState("");
  const [imageErrorMsg, setImageErrorMsg] = useState("");
  const [hasChosenFile, setHasChosenFile] = useState(false);
  const [handledState, setHandledState] = useState(state);
  const [syncedUsername, setSyncedUsername] = useState(savedUsername);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const id = useId();
  const usernameId = `${id}-username`;
  const imageInputId = `${id}-image`;
  const currentPasswordId = `${id}-current-password`;
  const newPasswordId = `${id}-new-password`;
  const confirmationId = `${id}-new-password-confirmation`;

  const clearPasswords = () => {
    setCurrentPassword("");
    setNewPassword("");
    setNewPasswordConfirmation("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
  };

  const setPasswordSectionOpen = (open: boolean) => {
    setIsChangingPassword(open);
    if (!open) {
      clearPasswords();
    }
  };

  // The server saves the name trimmed; once saved, that is what the field shows.
  if (savedUsername !== syncedUsername) {
    setSyncedUsername(savedUsername);
    setUsername(savedUsername);
  }

  if (state !== handledState) {
    setHandledState(state);
    // React has just reset the form, which empties the file input; the preview must follow it.
    setImagePreviewURL("");
    setImageErrorMsg("");
    setHasChosenFile(false);
    if (state.success) {
      setUsername(savedUsername);
    }
    if (state.success || state.passwordChanged) {
      setPasswordSectionOpen(false);
    } else if (hasPasswordErrors(state)) {
      setIsChangingPassword(true);
    }
  }

  useEffect(() => {
    if (state.message) {
      showActionToast(state);
    }
    const errors = state.errors?.properties;
    if (!errors) {
      return;
    }
    const fieldsInOrder = [
      { id: imageInputId, invalid: !!errors.image },
      { id: usernameId, invalid: !!errors.username },
      { id: currentPasswordId, invalid: !!errors.currentPassword },
      { id: newPasswordId, invalid: !!errors.newPassword },
      { id: confirmationId, invalid: !!errors.newPasswordConfirmation },
    ];
    const firstInvalid = fieldsInOrder.find((field) => field.invalid);
    if (firstInvalid) {
      document.getElementById(firstInvalid.id)?.focus();
    }
  }, [state, imageInputId, usernameId, currentPasswordId, newPasswordId, confirmationId]);

  useEffect(() => {
    return () => {
      if (imagePreviewURL) {
        URL.revokeObjectURL(imagePreviewURL);
      }
    };
  }, [imagePreviewURL]);

  const fieldErrors = state.errors?.properties;
  const usernameError = fieldErrors?.username?.errors.join(" ");
  const imageError = imageErrorMsg || fieldErrors?.image?.errors.join(" ");
  const passwordMismatch =
    newPassword && newPasswordConfirmation && newPassword !== newPasswordConfirmation
      ? "Las contraseñas no coinciden."
      : "";
  const currentPasswordError = fieldErrors?.currentPassword?.errors.join(" ");
  const newPasswordError = fieldErrors?.newPassword?.errors.join(" ");
  const confirmationError = passwordMismatch || fieldErrors?.newPasswordConfirmation?.errors.join(" ");
  const formError = state.errors?.errors.join(" ");
  // An open but empty section changes nothing, so it must not block a save of the rest.
  const passwordsRequired = isChangingPassword && !!(currentPassword || newPassword || newPasswordConfirmation);

  const onChooseImage = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setHasChosenFile(!!file);
    if (!file) {
      setImageErrorMsg("");
      setImagePreviewURL("");
      return;
    }
    const error = toAvatarError(file);
    setImageErrorMsg(error);
    setImagePreviewURL(error ? "" : URL.createObjectURL(file));
  };

  const keepCurrentImage = () => {
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
      imageInputRef.current.focus();
    }
    setImageErrorMsg("");
    setImagePreviewURL("");
    setHasChosenFile(false);
  };

  // Stopped before the action starts: React resets the form when an action runs, which would wipe what was typed.
  const blockInvalidSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    if (isPending) {
      event.preventDefault();
    } else if (imageErrorMsg) {
      event.preventDefault();
      imageInputRef.current?.focus();
    } else if (isChangingPassword && passwordMismatch) {
      event.preventDefault();
      document.getElementById(confirmationId)?.focus();
    }
  };

  const goBack = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const opensElsewhere = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0;
    // canGoBack counts only this app's entries, so a tab opened here from another site falls back to the href;
    // history.length, for browsers without the Navigation API, also counts other sites.
    const canGoBack = (window as WindowWithNavigation).navigation?.canGoBack ?? window.history.length > 1;
    if (!opensElsewhere && canGoBack) {
      event.preventDefault();
      router.back();
    }
  };

  return (
    <Form action={action} className="flex flex-col gap-6" onSubmit={blockInvalidSubmit}>
      {/* Lets a password manager tie a changed password to the account, whose login is the email. */}
      <input
        autoComplete="username"
        className="hidden"
        id={`${id}-account-email`}
        readOnly
        type="email"
        value={email}
      />
      <FieldGroup className="gap-5">
        <Field data-invalid={!!imageError || undefined}>
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className="size-32 shrink-0 overflow-hidden rounded-full ring-4 ring-primary sm:size-36">
              {imagePreviewURL ? (
                <Image
                  alt="Vista previa de la foto elegida"
                  className="size-full object-cover"
                  height={288}
                  src={imagePreviewURL}
                  width={288}
                />
              ) : (
                <CldImage
                  alt="Tu foto de perfil actual"
                  className="size-full object-cover"
                  crop="fill"
                  gravity="auto"
                  height={288}
                  src={imageId}
                  width={288}
                />
              )}
            </div>
            <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
              <FieldLabel htmlFor={imageInputId}>Foto de perfil</FieldLabel>
              <Input
                accept={ALLOWED_IMAGE_TYPES.join(",")}
                aria-describedby={`${imageInputId}-description${imageError ? ` ${imageInputId}-error` : ""}`}
                aria-invalid={!!imageError || undefined}
                className="text-sm text-foreground"
                id={imageInputId}
                name="image"
                onChange={onChooseImage}
                ref={imageInputRef}
                type="file"
              />
              <FieldDescription id={`${imageInputId}-description`}>
                Opcional. JPG, PNG, GIF o WebP de hasta {MAX_AVATAR_LABEL}.
              </FieldDescription>
              <FieldError id={`${imageInputId}-error`}>{imageError}</FieldError>
              {hasChosenFile && (
                <Button
                  className="self-start text-foreground"
                  onClick={keepCurrentImage}
                  size="sm"
                  type="button"
                  variant="ghost"
                >
                  Mantener la foto actual
                </Button>
              )}
            </div>
          </div>
        </Field>

        <Field data-invalid={!!usernameError || undefined}>
          <FieldLabel htmlFor={usernameId}>Nombre de usuario</FieldLabel>
          <InputGroup>
            <InputGroupInput
              aria-describedby={usernameError ? `${usernameId}-error` : undefined}
              aria-invalid={!!usernameError || undefined}
              autoComplete="nickname"
              id={usernameId}
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              required
              type="text"
              value={username}
            />
            <InputGroupAddon>
              <User />
            </InputGroupAddon>
          </InputGroup>
          <FieldError id={`${usernameId}-error`}>{usernameError}</FieldError>
        </Field>

        <Collapsible className="rounded-2xl border p-2" onOpenChange={setPasswordSectionOpen} open={isChangingPassword}>
          <CollapsibleTrigger className="group/trigger flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left font-medium outline-none focus-visible:focus-ring">
            ¿Cambiar contraseña?
            <ChevronDown
              aria-hidden="true"
              className="size-5 shrink-0 transition-transform group-data-panel-open/trigger:rotate-180 motion-reduce:transition-none"
            />
          </CollapsibleTrigger>
          {/* Disabled while closed, so nothing is sent that the server would take for a password change. */}
          <CollapsibleContent className="flex flex-col gap-5 px-3 py-3" keepMounted>
            <PasswordField
              autoComplete="current-password"
              disabled={!isChangingPassword}
              error={currentPasswordError}
              id={currentPasswordId}
              label="Contraseña actual"
              name="currentPassword"
              onChange={setCurrentPassword}
              required={passwordsRequired}
              toggle={{
                controls: currentPasswordId,
                label: "Mostrar contraseña actual",
                onToggle: () => setShowCurrentPassword(!showCurrentPassword),
              }}
              value={currentPassword}
              visible={showCurrentPassword}
            />
            <PasswordField
              autoComplete="new-password"
              disabled={!isChangingPassword}
              error={newPasswordError}
              id={newPasswordId}
              label="Nueva contraseña"
              name="newPassword"
              onChange={setNewPassword}
              required={passwordsRequired}
              toggle={{
                controls: `${newPasswordId} ${confirmationId}`,
                label: "Mostrar nueva contraseña",
                onToggle: () => setShowNewPassword(!showNewPassword),
              }}
              value={newPassword}
              visible={showNewPassword}
            />
            <PasswordField
              autoComplete="new-password"
              disabled={!isChangingPassword}
              error={confirmationError}
              id={confirmationId}
              label="Confirma la nueva contraseña"
              name="newPasswordConfirmation"
              onChange={setNewPasswordConfirmation}
              required={passwordsRequired}
              value={newPasswordConfirmation}
              visible={showNewPassword}
            />
          </CollapsibleContent>
        </Collapsible>
      </FieldGroup>

      {formError && (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link className={buttonVariants({ size: "lg", variant: "outline" })} href={BACK_FALLBACK_HREF} onClick={goBack}>
          Atrás
        </Link>
        {/* Focusable while pending, so the focus is not dropped to the page when the save starts. */}
        <Button
          className="data-disabled:opacity-50 data-disabled:active:not-aria-[haspopup]:translate-y-0"
          disabled={isPending}
          focusableWhenDisabled
          size="lg"
          type="submit"
        >
          {isPending && <Spinner data-icon="inline-start" />}
          Guardar cambios
        </Button>
      </div>
    </Form>
  );
}
