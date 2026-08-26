import { NetworkMark } from "@/components/brand/NetworkMark";
import { cn } from "@/lib/cn";

type AdminLogoProps = {
  className?: string;
};

export function AdminLogo({ className }: AdminLogoProps) {
  return (
    <NetworkMark
      title="Mreža"
      className={cn("h-10 w-10 shrink-0 text-mreza-600", className)}
    />
  );
}
