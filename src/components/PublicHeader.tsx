import { Link } from "react-router";

import { NetworkMark } from "@/components/brand/NetworkMark";

/**
 * Header javnih stranica. Providan je i stoji preko tamnog hero pojasa,
 * pa su boje svetle — hero uvek stoji ispod njega.
 */
export function PublicHeader() {
  return (
    <header className="relative z-10 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          to="/"
          className="flex items-center gap-3 rounded-lg text-mreza-300 transition hover:text-mreza-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mreza-400"
        >
          <NetworkMark className="h-9 w-9" />
          <span className="font-display text-lg font-semibold tracking-tight text-white">
            Mreža
          </span>
          <span className="sr-only">— početna</span>
        </Link>

        <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-mreza-400 sm:text-sm">
          Studenti pobeđuju
        </p>
      </div>
    </header>
  );
}
