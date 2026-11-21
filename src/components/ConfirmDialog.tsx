"use client";

import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog";
import { useEffect, useRef } from "react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  confirmLabel: string;
  description: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
  variant?: "default" | "destructive";
}

/** A modal that asks before going ahead; the caller owns `open`. On close, focus returns to what had it before opening. */
export default function ConfirmDialog({
  confirmLabel,
  description,
  onConfirm,
  onOpenChange,
  open,
  title,
  variant = "default",
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const hasConfirmedRef = useRef(false);

  useEffect(() => {
    if (open) {
      hasConfirmedRef.current = false;
    }
  }, [open]);

  // The popup stays mounted, and clickable, during its exit animation: a double click would confirm twice.
  const confirmOnce = () => {
    if (hasConfirmedRef.current) {
      return;
    }
    hasConfirmedRef.current = true;
    onConfirm();
  };

  return (
    <AlertDialog onOpenChange={(nextOpen) => onOpenChange(nextOpen)} open={open}>
      <AlertDialogContent initialFocus={variant === "destructive" ? cancelRef : confirmRef}>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel ref={cancelRef}>Cancelar</AlertDialogCancel>
          {/* A Close rather than a plain button: Base UI then sees a keyboard close and shows the focus ring on return. */}
          <AlertDialogPrimitive.Close
            data-slot="alert-dialog-action"
            onClick={confirmOnce}
            ref={confirmRef}
            render={<Button variant={variant} />}
          >
            {confirmLabel}
          </AlertDialogPrimitive.Close>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
