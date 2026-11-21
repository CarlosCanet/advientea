"use client";

import { Eye, EyeOff, KeyRound, Mail, User } from "lucide-react";
import Form from "next/form";
import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";

import { signup } from "@/app/actions/authActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { ALLOWED_IMAGE_TYPES, initialSignUpActionResponse } from "@/lib/types";

export default function SignUpForm() {
  const [state, action, isPending] = useActionState(signup, initialSignUpActionResponse);
  const [imagePreviewURL, setImagePreviewURL] = useState<string>("");
  const [imageErrorMsg, setImageErrorMsg] = useState<string>("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const id = useId();
  const usernameId = `${id}-username`;
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const confirmationId = `${id}-password-confirmation`;
  const imageId = `${id}-image`;

  useEffect(() => {
    return () => {
      if (imagePreviewURL) {
        URL.revokeObjectURL(imagePreviewURL);
      }
    };
  }, [imagePreviewURL]);

  useEffect(() => {
    if (state.errors) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImagePreviewURL("");
      setPassword("");
      setPasswordConfirmation("");
      setShowPassword(false);
    }
  }, [state.errors]);
  const passwordMismatch =
    password && passwordConfirmation && password !== passwordConfirmation ? "Las contraseñas no coinciden." : "";

  const fieldErrors = state.errors?.properties;
  const usernameError = fieldErrors?.username?.errors.join(" ");
  const emailError = fieldErrors?.email?.errors.join(" ");
  const passwordError = fieldErrors?.password?.errors.join(" ");
  const confirmationError = passwordMismatch || fieldErrors?.passwordConfirmation?.errors.join(" ");
  const imageError = [fieldErrors?.image?.errors.join(" "), imageErrorMsg].filter(Boolean).join(" ");
  const formError = state.errors?.errors.join(" ");

  const onAddFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageErrorMsg("");
    if (event.target.files && event.target.files.length > 0) {
      const imageFile = event.target.files[0];
      if (!ALLOWED_IMAGE_TYPES.includes(imageFile.type)) {
        event.currentTarget.value = "";
        setImageErrorMsg("Tipo de fichero no permitido");
        return;
      }
      setImagePreviewURL(URL.createObjectURL(imageFile));
    }
  };

  const describedBy = (fieldId: string, error?: string) => (error ? `${fieldId}-error` : undefined);

  return (
    <Card className="my-10 w-full max-w-md shadow-sm sm:my-16">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-3xl">Crear cuenta</h1>
        </CardTitle>
        <CardDescription className="text-base text-foreground">
          Con tu cuenta podrás adivinar los tés y contar la historia del tuyo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form action={action} className="flex flex-col gap-6">
          <FieldGroup className="gap-5">
            <Field data-invalid={!!usernameError || undefined}>
              <FieldLabel htmlFor={usernameId}>Nombre de usuario</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-describedby={describedBy(usernameId, usernameError)}
                  aria-invalid={!!usernameError || undefined}
                  defaultValue={state?.inputs?.username}
                  id={usernameId}
                  name="username"
                  required
                  type="text"
                />
                <InputGroupAddon>
                  <User />
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={`${usernameId}-error`}>{usernameError}</FieldError>
            </Field>

            <Field data-invalid={!!emailError || undefined}>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-describedby={describedBy(emailId, emailError)}
                  aria-invalid={!!emailError || undefined}
                  autoComplete="username"
                  defaultValue={state?.inputs?.email}
                  id={emailId}
                  name="email"
                  required
                  type="email"
                />
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={`${emailId}-error`}>{emailError}</FieldError>
            </Field>

            <Field data-invalid={!!passwordError || undefined}>
              <FieldLabel htmlFor={passwordId}>Contraseña</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-describedby={describedBy(passwordId, passwordError)}
                  aria-invalid={!!passwordError || undefined}
                  autoComplete="new-password"
                  id={passwordId}
                  name="password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <InputGroupAddon>
                  <KeyRound />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    aria-controls={`${passwordId} ${confirmationId}`}
                    aria-label="Mostrar contraseña"
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    size="icon-xs"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={`${passwordId}-error`}>{passwordError}</FieldError>
            </Field>

            <Field data-invalid={!!confirmationError || undefined}>
              <FieldLabel htmlFor={confirmationId}>Confirma la contraseña</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-describedby={describedBy(confirmationId, confirmationError)}
                  aria-invalid={!!confirmationError || undefined}
                  autoComplete="new-password"
                  id={confirmationId}
                  name="passwordConfirmation"
                  onChange={(e) => setPasswordConfirmation(e.target.value)}
                  required
                  type={showPassword ? "text" : "password"}
                  value={passwordConfirmation}
                />
                <InputGroupAddon>
                  <KeyRound />
                </InputGroupAddon>
              </InputGroup>
              <FieldError id={`${confirmationId}-error`}>{confirmationError}</FieldError>
            </Field>

            <Field data-invalid={!!imageError || undefined}>
              <FieldLabel htmlFor={imageId}>Foto de perfil</FieldLabel>
              <div className="flex items-center gap-4">
                <div className="size-20 shrink-0 overflow-hidden rounded-full ring-1 ring-foreground/10">
                  <Image
                    alt="Vista previa de la foto de perfil"
                    className="size-full object-cover"
                    height={96}
                    src={imagePreviewURL || "/TeaLeavesImage.jpg"}
                    width={96}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <Input
                    aria-describedby={`${imageId}-description${imageError ? ` ${imageId}-error` : ""}`}
                    aria-invalid={!!imageError || undefined}
                    className="text-sm"
                    id={imageId}
                    name="image"
                    onChange={onAddFile}
                    type="file"
                  />
                  <FieldDescription id={`${imageId}-description`}>
                    Opcional. JPG, PNG, GIF o WebP de hasta 2 MB.
                  </FieldDescription>
                </div>
              </div>
              <FieldError id={`${imageId}-error`}>{imageError}</FieldError>
            </Field>
          </FieldGroup>

          {formError && (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          )}

          <Button className="w-full" disabled={isPending || !!passwordMismatch} size="lg" type="submit">
            {isPending && <Spinner data-icon="inline-start" />}
            Crear cuenta
          </Button>
        </Form>
      </CardContent>
      <CardFooter className="justify-center text-center">
        <p>
          ¿Ya tienes cuenta?{" "}
          <Link className="font-medium text-foreground underline underline-offset-4" href="/sign-in">
            Entra
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
