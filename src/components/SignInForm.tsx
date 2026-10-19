"use client";

import Form from "next/form";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { GiBrainLeak } from "react-icons/gi";
import { IoKeySharp } from "react-icons/io5";
import { MdEmail } from "react-icons/md";

import { signin } from "@/app/actions/authActions";
import { initialSignInActionResponse } from "@/lib/types";

export default function SignInForm() {
  const [state, action, isPending] = useActionState(signin, initialSignInActionResponse);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState<boolean>(false);

  return (
    <div className="card w-full max-w-xl bg-base-100 shadow-xl mt-20 mb-20">
      <Form action={action} className="card-body">
        <h2 className="card-title">Login</h2>
        <div className="items-center mt-2">
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input autoComplete="username" className="grow" name="email" placeholder="Email" required type="email" />
          </label>
          {state?.errors?.email && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.email.join(", ")}</p>
          )}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              autoComplete="current-password"
              className="grow"
              name="password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Introduce tu contraseña"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button className="cursor-pointer" onClick={() => setShowPassword(!showPassword)} type="button">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.password && (
            <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.password.join(", ")}</p>
          )}
        </div>
        <div className="card-actions justify-center mt-4">
          <button className="btn btn-primary w-full" disabled={isPending} type="submit">
            {isPending ? <span className="loading loading-spinner"></span> : "Login"}
          </button>
        </div>
        <div className="divider"></div>
        <div className="flex gap-2 items-center justify-center">
          <GiBrainLeak />
          <Link className="link-neutral" href="/reset-password">
            {" "}
            He olvidado mi contraseña
          </Link>
        </div>
      </Form>
    </div>
  );
}
