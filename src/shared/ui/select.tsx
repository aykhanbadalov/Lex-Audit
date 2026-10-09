import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

/** The arrow is drawn here, with room around it, because the browser's own arrow sits hard against the right edge. */
export const SELECT_CLASS =
  "h-9 w-full appearance-none rounded-md border border-input bg-background bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20width=%2216%22%20height=%2216%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22%236b7280%22%20stroke-width=%222%22%20stroke-linecap=%22round%22%20stroke-linejoin=%22round%22><path%20d=%22m6%209%206%206%206-6%22/></svg>')] bg-[length:1rem] bg-[position:right_0.625rem_center] bg-no-repeat pr-9 pl-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:opacity-50";

/** A native <select>: fully accessible and keyboard friendly out of the box. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cn(SELECT_CLASS, className)} {...props} />;
}
