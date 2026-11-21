"use client";

import { Eye, EyeOff, KeyRound, Mail } from "lucide-react";
import Form from "next/form";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { signin } from "@/app/actions/authActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { initialSignInActionResponse } from "@/lib/types";

export default function SignInForm() {
  const [state, action, isPending] = useActionState(signin, initialSignInActionResponse);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const id = useId();
  const emailId = `${id}-email`;
  const passwordId = `${id}-password`;
  const emailError = state?.errors?.email?.join(", ");
  const passwordError = state?.errors?.password?.join(", ");

  return (
    <Card className="my-10 w-full max-w-md shadow-sm sm:my-16">
      <CardHeader>
        <CardTitle>
          <h1 className="font-display text-3xl">Entrar</h1>
        </CardTitle>
        <CardDescription className="text-base text-foreground">
          Entra con tu email para descubrir el té de cada día.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form action={action} className="flex flex-col gap-6">
          <FieldGroup className="gap-5">
            <Field data-invalid={!!emailError || undefined}>
              <FieldLabel htmlFor={emailId}>Email</FieldLabel>
              <InputGroup>
                <InputGroupInput
                  aria-describedby={emailError ? `${emailId}-error` : undefined}
                  aria-invalid={!!emailError || undefined}
                  autoComplete="username"
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
                  aria-describedby={passwordError ? `${passwordId}-error` : undefined}
                  aria-invalid={!!passwordError || undefined}
                  autoComplete="current-password"
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
                    aria-controls={passwordId}
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
          </FieldGroup>

          <Button className="w-full" disabled={isPending} size="lg" type="submit">
            {isPending && <Spinner data-icon="inline-start" />}
            Entrar
          </Button>
        </Form>
      </CardContent>
      <CardFooter className="flex-col gap-3 text-center">
        <Link className="text-foreground underline underline-offset-4" href="/reset-password">
          He olvidado mi contraseña
        </Link>
        <p>
          ¿Aún no tienes cuenta?{" "}
          <Link className="font-medium text-foreground underline underline-offset-4" href="/sign-up">
            Crea una
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
