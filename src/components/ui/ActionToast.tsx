"use client";
import { ActionResponse } from "@/lib/types";
import { useEffect, useState } from "react";

export type Toast = { kind: "success" | "error"; message: string };

export function useActionToast(durationMs = 5000) {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), durationMs);
    return () => clearTimeout(timer);
  }, [toast, durationMs]);

  const showToast = (result: ActionResponse) =>
    setToast({ kind: result.success ? "success" : "error", message: result.message });

  return { toast, showToast };
}

export default function ActionToast({ toast }: { toast: Toast | null }) {
  if (!toast) return null;
  return (
    <div className="toast">
      <div className={`alert ${toast.kind === "success" ? "alert-success" : "alert-error"}`}>
        <span>{toast.message}</span>
      </div>
    </div>
  );
}
