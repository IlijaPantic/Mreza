import { type TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "@/lib/cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "min-h-24 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-sans text-sm text-slate-900 placeholder:text-slate-400 focus:border-mreza-500 focus:outline-none focus:ring-2 focus:ring-mreza-500/30 disabled:cursor-not-allowed disabled:bg-slate-100",
          className,
        )}
        {...props}
      />
    );
  },
);
