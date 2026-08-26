import { type LabelHTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export function Label({ className, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        "mb-1 block font-sans text-sm font-medium text-slate-800",
        className,
      )}
      {...props}
    />
  );
}
