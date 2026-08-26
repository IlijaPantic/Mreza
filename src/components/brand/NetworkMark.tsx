import { cn } from "@/lib/cn";

type NetworkMarkProps = {
  className?: string;
  /** Dekorativno po defaultu; prosledi title kad znak stoji sam kao logo. */
  title?: string;
};

/**
 * Znak brenda: jedno jezgro, tri cvora u orbiti, veze medju njima.
 *
 * Crta se u `currentColor` tako da isti znak radi i na tamnoj i na svetloj
 * podlozi — boju odredjuje roditelj, ne komponenta.
 */
export function NetworkMark({ className, title }: NetworkMarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={cn("h-10 w-10 shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}

      {/* Orbita — nagnuta elipsa daje utisak prostora oko jezgra. */}
      <ellipse
        cx="24"
        cy="24"
        rx="19.5"
        ry="9.5"
        transform="rotate(-28 24 24)"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.32"
      />

      {/* Veze jezgro -> cvor. */}
      <path
        d="M24 24 38 13.5M24 24 9.5 18M24 24 26.5 40"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />

      {/* Cvorovi. */}
      <circle cx="24" cy="24" r="5.75" fill="currentColor" />
      <circle cx="38" cy="13.5" r="3.5" fill="currentColor" />
      <circle cx="9.5" cy="18" r="3.5" fill="currentColor" />
      <circle cx="26.5" cy="40" r="3.5" fill="currentColor" />
    </svg>
  );
}
