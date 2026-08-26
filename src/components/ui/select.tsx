import { type SelectHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/cn";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 font-sans text-sm text-slate-900 focus:border-mreza-500 focus:outline-none focus:ring-2 focus:ring-mreza-500/30 disabled:cursor-not-allowed disabled:bg-slate-100",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});
