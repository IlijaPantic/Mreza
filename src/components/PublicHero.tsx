import { NetworkField } from "@/components/brand/NetworkField";
import { PublicHeader } from "@/components/PublicHeader";

type PublicHeroProps = {
  /** Mala oznaka iznad naslova. */
  eyebrow: string;
  /** Naslov; delovi mogu biti naglaseni preko <Accent>. */
  title: React.ReactNode;
  /** Uvodni pasus ispod naslova. Opciono. */
  lead?: React.ReactNode;
};

/**
 * Tamni pojas na vrhu javnih stranica: mreza cvorova iza teksta, header preko
 * nje, i prelaz u belu pozadinu na dnu tako da se sadrzaj nastavlja bez seva.
 *
 * Grafika je `pointer-events-none` da nikad ne presretne klik na header.
 */
export function PublicHero({ eyebrow, title, lead }: PublicHeroProps) {
  return (
    <div className="relative isolate overflow-hidden bg-slate-950">
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <NetworkField />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-white" />

      <PublicHeader />

      <div className="relative z-10 mx-auto max-w-3xl px-4 pb-24 pt-8 text-center sm:px-6 sm:pt-12">
        <p className="font-display text-xs font-semibold uppercase tracking-[0.25em] text-mreza-400">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {lead && (
          <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
            {lead}
          </p>
        )}
      </div>
    </div>
  );
}

/** Naglaseni deo naslova u boji brenda. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="text-mreza-400">{children}</span>;
}
