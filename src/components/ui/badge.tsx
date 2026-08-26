import { type HTMLAttributes } from "react";

import { cn } from "@/lib/cn";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: "admin" | "viewer" | "accent" | "default";
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "admin" && "bg-mreza-100 text-mreza-800",
        variant === "viewer" && "bg-slate-100 text-slate-700",
        variant === "accent" && "bg-node-500/10 text-node-700",
        variant === "default" && "bg-slate-100 text-slate-600",
        className,
      )}
      {...props}
    />
  );
}
