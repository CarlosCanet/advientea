"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import Form from "next/form";
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
    <div className="card w-96 bg-base-100 shadow-xl mt-20 mb-20">
      <Form className="card-body" action={action}>
        <h2 className="card-title">Login</h2>
        <div className="items-center mt-2">
          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <MdEmail />
            <input type="email" name="email" className="grow" placeholder="Email" required />
          </label>
          {state?.errors?.email && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.email.join(", ")}</p>}

          <label className="input input-bordered flex items-center gap-2 mb-2 w-full">
            <IoKeySharp />
            <input
              name="password"
              type={showPassword ? "text" : "password"}
              className="grow"
              placeholder="Introduce tu contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="cursor-pointer">
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </label>
          {state?.errors?.password && <p className="text-xs text-error font-bold -mt-2 mb-2">{state.errors.password.join(", ")}</p>}
        </div>
        <div className="card-actions justify-center mt-4">
          <button className="btn btn-primary w-full" type="submit" disabled={isPending}>
            {isPending ? <span className="loading loading-spinner"></span> : "Login"}
          </button>
        </div>
        <div className="divider"></div>
        <div className="flex gap-2 items-center justify-center">
          <GiBrainLeak />
          <Link href="/reset-password" className="link-neutral"> He olvidado mi contraseña</Link>
        </div>
      </Form>
    </div>
  );
}
