"use client";

import Form from "next/form";
import Link from "next/link";
import { useActionState } from "react";
import { MdEmail } from "react-icons/md";

import { requestPasswordResetAction } from "@/app/actions/authActions";
import { initialRequestPasswordResetActionResponse } from "@/lib/types";

interface RequestPasswordResetFormProps {
  /** Shown above the form, such as why the previous link no longer works. */
  notice?: string;
}

export default function RequestPasswordResetForm({ notice }: RequestPasswordResetFormProps) {
  const [state, action, isPending] = useActionState(
    requestPasswordResetAction,
    initialRequestPasswordResetActionResponse,
  );
  const emailError = state.errors?.email?.join(", ");
  const formError = !state.success && !state.errors && state.message;
  // Mounted from the start, so a screen reader announces each answer; the visible messages appear only with it.
  const announcement = [state.message, emailError]
    .filter((text, index, all) => text && all.indexOf(text) === index)
    .join(". ");

  return (
    <div className="card w-full max-w-xl bg-base-100 shadow-xl mt-20 mb-20">
      <Form action={action} className="card-body">
        <h2 className="card-title">Recuperar la contraseña</h2>
        {notice && !state.success && (
          <p className="alert alert-warning" role="alert">
            {notice}
          </p>
        )}
        <p>Escribe el email de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.</p>
        <div className="items-center mt-2">
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input
              aria-describedby={emailError ? "email-error" : undefined}
              aria-invalid={Boolean(emailError)}
              aria-label="Email"
              autoComplete="email"
              className="grow"
              defaultValue={state.inputs?.email}
              name="email"
              placeholder="Email"
              required
              type="email"
            />
          </label>
          {emailError && (
            <p className="text-xs text-error font-bold -mt-2 mb-2" id="email-error">
              {emailError}
            </p>
          )}
        </div>
        {state.success && <p className="alert alert-success">{state.message}</p>}
        {formError && <p className="alert alert-error">{formError}</p>}
        <div className="card-actions justify-center mt-4">
          <button className="btn btn-primary w-full" disabled={isPending} type="submit">
            {isPending ? <span className="loading loading-spinner"></span> : "Enviar el enlace"}
          </button>
        </div>
        <div className="divider"></div>
        <div className="flex justify-center">
          <Link className="link-neutral" href="/sign-in">
            Volver al login
          </Link>
        </div>
      </Form>
    </div>
  );
}
