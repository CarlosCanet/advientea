"use client";

import Form from "next/form";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { IoKeySharp } from "react-icons/io5";

import { resetPasswordAction } from "@/app/actions/authActions";
import { initialResetPasswordActionResponse } from "@/lib/types";

interface ResetPasswordFormProps {
  token: string;
}

export default function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [state, action, isPending] = useActionState(resetPasswordAction, initialResetPasswordActionResponse);
  // Kept in state: React resets the form after every action, and a rejected password must not be typed twice.
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirmation, setNewPasswordConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const tokenError = state.errors?.token?.join(", ");
  const newPasswordError = state.errors?.newPassword?.join(", ");
  const newPasswordConfirmationError = state.errors?.newPasswordConfirmation?.join(", ");
  const formError = !state.success && !state.errors && state.message;
  // Mounted from the start, so a screen reader announces each answer; the visible messages appear only with it.
  const announcement = [state.message, tokenError, newPasswordError, newPasswordConfirmationError]
    .filter((text, index, all) => text && all.indexOf(text) === index)
    .join(". ");

  return (
    <div className="card w-full max-w-xl bg-base-100 shadow-xl mt-20 mb-20">
      <Form action={action} className="card-body">
        <h2 className="card-title">Elige una contraseña nueva</h2>
        <input name="token" type="hidden" value={token} />
        {tokenError && (
          <div className="alert alert-error flex-col items-start">
            <p>{tokenError}</p>
            <Link className="link" href="/reset-password">
              Pedir un enlace nuevo
            </Link>
          </div>
        )}
        <div className="items-center mt-2">
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
          {!tokenError && (
            <>
              <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
                <IoKeySharp />
                <input
                  aria-describedby={newPasswordError ? "newPassword-error" : undefined}
                  aria-invalid={Boolean(newPasswordError)}
                  aria-label="Contraseña nueva"
                  autoComplete="new-password"
                  className="grow"
                  name="newPassword"
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Contraseña nueva"
                  required
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                />
                <button
                  aria-label={showPassword ? "Ocultar la contraseña" : "Mostrar la contraseña"}
                  className="cursor-pointer"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </label>
              {newPasswordError && (
                <p className="text-xs text-error font-bold -mt-2 mb-2" id="newPassword-error">
                  {newPasswordError}
                </p>
              )}
              <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
                <IoKeySharp />
                <input
                  aria-describedby={newPasswordConfirmationError ? "newPasswordConfirmation-error" : undefined}
                  aria-invalid={Boolean(newPasswordConfirmationError)}
                  aria-label="Repite la contraseña nueva"
                  autoComplete="new-password"
                  className="grow"
                  name="newPasswordConfirmation"
                  onChange={(e) => setNewPasswordConfirmation(e.target.value)}
                  placeholder="Repite la contraseña nueva"
                  required
                  type={showPassword ? "text" : "password"}
                  value={newPasswordConfirmation}
                />
              </label>
              {newPasswordConfirmationError && (
                <p className="text-xs text-error font-bold -mt-2 mb-2" id="newPasswordConfirmation-error">
                  {newPasswordConfirmationError}
                </p>
              )}
            </>
          )}
        </div>
        {formError && <p className="alert alert-error">{formError}</p>}
        {/* A rejected link never works again: only the way to ask for another is left. */}
        {!tokenError && (
          <div className="card-actions justify-center mt-4">
            <button className="btn btn-primary w-full" disabled={isPending} type="submit">
              {isPending ? <span className="loading loading-spinner"></span> : "Cambiar la contraseña"}
            </button>
          </div>
        )}
      </Form>
    </div>
  );
}
