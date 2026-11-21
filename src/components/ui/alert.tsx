import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import * as React from "react";

const alertVariants = cva(
  "relative grid w-full gap-0.5 rounded-2xl px-4 py-3 text-left text-sm ring-1 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2.5 *:[svg]:row-span-2 *:[svg]:translate-y-0.5 *:[svg]:text-current *:[svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: {
      variant: "default",
    },
    variants: {
      variant: {
        default: "bg-popover text-popover-foreground ring-foreground/10",
        destructive: "bg-popover text-destructive ring-destructive/40 *:data-[slot=alert-description]:text-destructive",
        // Honey, the calendar's own amber, rather than a stock yellow: amber 12 on it is well above 7:1.
        warning: "bg-honey/45 text-honey-foreground ring-honey",
      },
    },
  },
);

// No role by default: these alerts are rendered with the page, and a live region there is only noise.
// Give `role="alert"` to one that appears after something the user did.
function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div className={cn(alertVariants({ variant }), className)} data-slot="alert" {...props} />;
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("font-semibold [&_a]:underline", className)} data-slot="alert-title" {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-sm text-balance md:text-pretty [&_a]:underline [&_p:not(:last-child)]:mb-4", className)}
      data-slot="alert-description"
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
