import { cn } from "cn";

function AspectRatio({ className, ratio, ...props }: React.ComponentProps<"div"> & { ratio: number }) {
  return (
    <div
      className={cn("relative aspect-(--ratio)", className)}
      data-slot="aspect-ratio"
      style={
        {
          "--ratio": ratio,
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { AspectRatio };
