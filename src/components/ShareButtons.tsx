import { useState } from "react";

import { cn } from "@/lib/cn";

type ShareButtonsProps = {
  className?: string;
};

const SHARE_TEXT =
  "Uključi se u javnu kampanju — prijavi se i biraj kako želiš da učestvuješ.";

function getShareUrl(): string {
  if (typeof window === "undefined") return "https://mreza.rs/";
  return `${window.location.origin}/`;
}

function buildText(url: string): string {
  return `${SHARE_TEXT} ${url}`;
}

export function ShareButtons({ className }: ShareButtonsProps) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const url = getShareUrl();
  const text = buildText(url);
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  const encodedTextOnly = encodeURIComponent(SHARE_TEXT);

  const whatsappHref = `https://wa.me/?text=${encodedText}`;
  const telegramHref = `https://t.me/share/url?url=${encodedUrl}&text=${encodedTextOnly}`;
  const viberHref = `viber://forward?text=${encodedText}`;

  async function handleSignal() {
    if (
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function"
    ) {
      try {
        await navigator.share({
          title: "Mreža — javna kampanja",
          text: SHARE_TEXT,
          url,
        });
        return;
      } catch {
        // user dismissed or error → fall through to copy
      }
    }
    await handleCopy();
  }

  async function handleCopy() {
    if (
      typeof navigator !== "undefined" &&
      navigator.clipboard?.writeText !== undefined
    ) {
      try {
        await navigator.clipboard.writeText(text);
        setCopyState("copied");
        window.setTimeout(() => setCopyState("idle"), 2500);
        return;
      } catch {
        // continue to fallback
      }
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2500);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 3000);
    }
  }

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <ShareLink
          href={whatsappHref}
          label="WhatsApp"
          bgClass="bg-[#25D366] hover:bg-[#1FB957]"
          icon={<WhatsAppIcon />}
        />
        <ShareLink
          href={viberHref}
          label="Viber"
          bgClass="bg-[#7360F2] hover:bg-[#5E4DD8]"
          icon={<ViberIcon />}
        />
        <ShareLink
          href={telegramHref}
          label="Telegram"
          bgClass="bg-[#26A5E4] hover:bg-[#1E8DC7]"
          icon={<TelegramIcon />}
        />
        <ShareButton
          label="Signal"
          bgClass="bg-[#3A76F0] hover:bg-[#2F65D5]"
          icon={<SignalIcon />}
          onClick={() => void handleSignal()}
        />
      </div>

      <button
        type="button"
        onClick={() => void handleCopy()}
        className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-mreza-700 hover:underline"
      >
        {copyState === "copied"
          ? "Link kopiran"
          : copyState === "error"
            ? "Nije moguće kopirati"
            : "Kopiraj link"}
      </button>
    </div>
  );
}

type ShareLinkProps = {
  href: string;
  label: string;
  bgClass: string;
  icon: React.ReactNode;
};

function ShareLink({ href, label, bgClass, icon }: ShareLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white shadow-sm transition",
        bgClass,
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </a>
  );
}

type ShareButtonProps = {
  label: string;
  bgClass: string;
  icon: React.ReactNode;
  onClick: () => void;
};

function ShareButton({ label, bgClass, icon, onClick }: ShareButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium text-white shadow-sm transition",
        bgClass,
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M20.52 3.48A11.93 11.93 0 0 0 12.06 0C5.5 0 .15 5.34.15 11.9c0 2.1.55 4.15 1.6 5.95L0 24l6.32-1.66a11.9 11.9 0 0 0 5.74 1.47h.01c6.56 0 11.9-5.34 11.91-11.9 0-3.18-1.24-6.17-3.46-8.43Zm-8.46 18.3h-.01a9.86 9.86 0 0 1-5.03-1.38l-.36-.21-3.75.98 1-3.65-.23-.37a9.85 9.85 0 0 1-1.51-5.25c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.13 1.03 7 2.9a9.83 9.83 0 0 1 2.9 7c-.01 5.46-4.45 9.86-9.91 9.86Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15s-.77.97-.94 1.17c-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.08-.15-.67-1.62-.92-2.21-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.49 0 1.47 1.07 2.89 1.22 3.09.15.2 2.1 3.21 5.1 4.5.71.31 1.27.5 1.7.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.42.25-.7.25-1.29.18-1.42-.07-.13-.27-.2-.57-.35Z" />
    </svg>
  );
}

function ViberIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M19.5 3.4C18.4 2.4 14.6 1.5 12 1.5c-2.6 0-6.4.9-7.5 1.9C2.9 4.8 2 8.4 2 11.5c0 1.7.4 4 1.4 5.6.4.7 1.1 1.3 1.8 1.6v3l2.7-1.6c.7.1 1.4.2 2.2.3 1.3.1 2.6 0 3.9-.2v-2l-1.7 1.2c-1 .1-2 .1-3 0-3-.4-4.4-1.5-4.9-2.5-.8-1.4-1.2-3.4-1.2-4.7 0-2.8.8-5.9 1.9-7 .6-.6 3.7-1.5 6.5-1.5 2.7 0 5.6.9 6.5 1.6 1 1 1.9 4.1 1.9 6.8 0 1.4-.4 3.4-1.2 4.8-.4.6-1 1.1-1.7 1.5l.6 1.8c1-.4 1.9-1.1 2.5-1.9 1-1.6 1.4-4 1.4-5.7-.1-3-.9-6.6-2.6-8.1Z" />
      <path d="M8.5 6.2c-.4 0-1 .1-1.4.6-.5.6-.7 1.5-.4 2.7.4 1.7 1.3 3.4 2.6 4.8 1.3 1.4 2.9 2.4 4.6 2.9.6.2 1.2.2 1.7 0 .5-.2 1-.6 1.2-1l.2-.5c.1-.2 0-.4-.2-.5l-1.7-1.1c-.2-.1-.4-.1-.5.1l-.5.6c-.1.2-.4.2-.6.1-.7-.3-1.4-.8-2-1.4-.6-.6-1.1-1.3-1.4-2-.1-.2-.1-.4.1-.6l.6-.5c.2-.2.2-.4.1-.5l-1-1.7c-.1-.2-.3-.3-.5-.2l-.5.2Z" />
      <path d="M12 4.7c-.3 0-.5.2-.5.5s.2.5.5.5c1.6 0 3.2.6 4.4 1.7 1.2 1.2 1.9 2.7 1.9 4.4 0 .3.2.5.5.5s.5-.2.5-.5c0-1.9-.8-3.8-2.2-5.1A7.3 7.3 0 0 0 12 4.7Z" />
      <path d="M12 6.4c-.3 0-.5.2-.5.5s.2.5.5.5c1.2 0 2.3.5 3.2 1.3.8.8 1.3 2 1.3 3.1 0 .3.2.5.5.5s.5-.2.5-.5c0-1.4-.6-2.8-1.6-3.8a5.2 5.2 0 0 0-3.9-1.6Z" />
      <path d="M12 8c-.3 0-.5.2-.5.5s.2.5.5.5c.8 0 1.5.3 2 .8.5.5.8 1.3.8 2 0 .3.2.5.5.5s.5-.2.5-.5c0-1-.4-2-1.1-2.7-.8-.7-1.7-1.1-2.7-1.1Z" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M9.04 15.79 8.74 20c.43 0 .62-.19.85-.41l2.03-1.94 4.21 3.08c.77.43 1.32.21 1.53-.71L21.85 4.7c.27-1.15-.42-1.6-1.18-1.33L2.3 10.36c-1.13.44-1.11 1.06-.2 1.35l4.74 1.48L17.84 6.4c.52-.33 1-.15.6.18L9.04 15.79Z" />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
      <path d="M9.18 1.18 9.5 2.65a9.8 9.8 0 0 0-2.18.91l-.78-1.3a11.27 11.27 0 0 1 2.64-1.08Zm5.64 0a11.27 11.27 0 0 1 2.64 1.08l-.78 1.3a9.8 9.8 0 0 0-2.18-.9l.32-1.48ZM3.86 4.27 4.93 5.34a9.83 9.83 0 0 0-1.45 1.81l-1.3-.78c.46-.74 1.02-1.43 1.68-2.1Zm16.28 0c.66.67 1.22 1.36 1.68 2.1l-1.3.78a9.83 9.83 0 0 0-1.45-1.81l1.07-1.07ZM1.16 9.18l1.48.32c-.21.71-.32 1.43-.32 2.18H.8a11.18 11.18 0 0 1 .36-2.5Zm21.68 0c.23.81.36 1.65.36 2.5h-1.52c0-.75-.11-1.47-.32-2.18l1.48-.32ZM2.32 14.32c.21.71.5 1.4.86 2.04l-1.3.78a11.27 11.27 0 0 1-1.08-2.5l1.52-.32Zm19.36 0 1.52.32a11.27 11.27 0 0 1-1.08 2.5l-1.3-.78c.36-.64.65-1.33.86-2.04ZM4.93 18.66l1.45 1.45a11.27 11.27 0 0 1-2.1-1.68l1.07-1.07c.18.43.4.84.66 1.22l-1.08.08Zm14.14 0-1.08-.08c.26-.38.48-.79.66-1.22l1.07 1.07a11.27 11.27 0 0 1-2.1 1.68l1.45-1.45ZM12 4.5c-4.14 0-7.5 3.36-7.5 7.5 0 1.3.34 2.58.98 3.71L4.5 19.5l3.79-.98a7.5 7.5 0 1 0 3.71-14.02Z" />
    </svg>
  );
}
