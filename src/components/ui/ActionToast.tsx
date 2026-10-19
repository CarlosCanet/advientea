"use client";
import { useEffect, useState } from "react";

import { ActionResponse } from "@/lib/types";

export type Toast = { kind: "error" | "success"; message: string };

export function useActionToast(durationMs = 5000) {
  const [toast, setToast] = useState<null | Toast>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  const showToast = (result: ActionResponse) =>
    setToast({ kind: result.success ? "success" : "error", message: result.message });

  return { showToast, toast };
}

export default function ActionToast({ toast }: { toast: null | Toast }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <div className={`alert ${toast.kind === "success" ? "alert-success" : "alert-error"}`}>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
