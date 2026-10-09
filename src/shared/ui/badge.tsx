import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/shared/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "bg-secondary text-secondary-foreground border-transparent",
        info: "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
        success: "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
        warning: "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
        danger: "border-transparent bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
        outline: "text-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>["tone"]>;

export function Badge({ className, tone, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
