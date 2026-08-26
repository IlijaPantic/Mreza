import { SocialNetwork } from "@/gen/mreza/v1/survey_pb";
import { cn } from "@/lib/cn";

/**
 * Ikonice drustvenih mreza. Sve su jednobojne i crtaju se u `currentColor`,
 * pa preuzimaju boju stanja iz roditelja (izabrano / neizabrano).
 *
 * Ikonice su dekoracija — labela pored njih nosi znacenje, pa su aria-hidden.
 */

type IconProps = { className?: string };

function Facebook({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.49-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.470h-1.26c-1.24 0-1.63.78-1.63 1.57v1.88h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

function Instagram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <rect
        x="3"
        y="3"
        width="18"
        height="18"
        rx="5"
        stroke="currentColor"
        strokeWidth="1.9"
      />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.9" />
      <circle cx="17.4" cy="6.6" r="1.2" fill="currentColor" />
    </svg>
  );
}

function TikTok({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M16.6 2h-2.9v13.2a2.5 2.5 0 1 1-2.2-2.48v-2.94a5.4 5.4 0 1 0 5.1 5.39V8.9a6.4 6.4 0 0 0 3.7 1.18V7.14A3.6 3.6 0 0 1 16.6 3.6V2Z" />
    </svg>
  );
}

function YouTube({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M21.6 7.2a2.5 2.5 0 0 0-1.75-1.77C18.28 5 12 5 12 5s-6.28 0-7.85.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.75 1.77C5.72 19 12 19 12 19s6.28 0 7.85-.43a2.5 2.5 0 0 0 1.75-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8ZM10 15.02V8.98L15.2 12 10 15.02Z" />
    </svg>
  );
}

function Telegram({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M9.04 15.79 8.74 20c.43 0 .62-.19.85-.41l2.03-1.94 4.21 3.08c.77.43 1.32.21 1.53-.71L21.85 4.7c.27-1.15-.42-1.6-1.18-1.33L2.3 10.36c-1.13.44-1.11 1.06-.2 1.35l4.74 1.48L17.84 6.4c.52-.33 1-.15.6.18L9.04 15.79Z" />
    </svg>
  );
}

function X({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.53 3h3.06l-6.69 7.64L21.75 21h-6.16l-4.83-6.3L5.24 21H2.18l7.15-8.17L2.25 3h6.31l4.37 5.77L17.53 3Zm-1.07 16.17h1.7L7.62 4.74H5.8l10.66 14.43Z" />
    </svg>
  );
}

function Blog({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.9" />
      <path
        d="M3 12h18M12 3c2.4 2.4 3.6 5.4 3.6 9s-1.2 6.6-3.6 9c-2.4-2.4-3.6-5.4-3.6-9S9.6 5.4 12 3Z"
        stroke="currentColor"
        strokeWidth="1.9"
      />
    </svg>
  );
}

const ICON_BY_NETWORK: Record<
  SocialNetwork,
  ((props: IconProps) => React.ReactElement) | undefined
> = {
  [SocialNetwork.UNSPECIFIED]: undefined,
  [SocialNetwork.FACEBOOK]: Facebook,
  [SocialNetwork.INSTAGRAM]: Instagram,
  [SocialNetwork.TIKTOK]: TikTok,
  [SocialNetwork.YOUTUBE]: YouTube,
  [SocialNetwork.TELEGRAM]: Telegram,
  [SocialNetwork.X]: X,
  [SocialNetwork.BLOG]: Blog,
};

type NetworkIconProps = {
  network: SocialNetwork;
  className?: string;
};

export function NetworkIcon({ network, className }: NetworkIconProps) {
  const Icon = ICON_BY_NETWORK[network];
  if (!Icon) return null;
  return (
    <span aria-hidden="true" className="contents">
      <Icon className={cn("h-5 w-5 shrink-0", className)} />
    </span>
  );
}
