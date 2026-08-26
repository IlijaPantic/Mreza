import { Link } from "react-router";

import { NetworkMark } from "@/components/brand/NetworkMark";

export function PublicFooter() {
  return (
    <footer className="mt-16 w-full bg-slate-950 py-10 text-slate-300">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 text-center sm:px-6">
        <NetworkMark className="h-8 w-8 text-mreza-400" />

        <p className="text-sm">
          <Link
            to="/privatnost"
            className="text-mreza-300 underline-offset-4 hover:text-mreza-200 hover:underline"
          >
            Politika privatnosti
          </Link>
        </p>

        <p className="font-display text-xs uppercase tracking-[0.2em] text-slate-500">
          © {new Date().getFullYear()} Mreža — javna kampanja
        </p>
      </div>
    </footer>
  );
}
