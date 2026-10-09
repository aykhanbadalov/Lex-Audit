import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

/** A native <select>: fully accessible and keyboard friendly out of the box. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}
