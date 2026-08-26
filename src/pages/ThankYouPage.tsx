import { useEffect } from "react";

import { PublicFooter } from "@/components/PublicFooter";
import { Accent, PublicHero } from "@/components/PublicHero";
import { ShareButtons } from "@/components/ShareButtons";

export function ThankYouPage() {
  useEffect(() => {
    document.title = "Mreža — Hvala na prijavi";
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHero
        eyebrow="Prijava je primljena"
        title={
          <>
            Mreža je <Accent>šira</Accent> za jedan čvor
          </>
        }
      />

      <main className="flex-1">
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto -mt-14 max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
              <div className="space-y-4 text-base leading-relaxed text-slate-700 sm:text-lg">
                <p>
                  Hvala što si se prijavio/la. Tvoji podaci su sačuvani i
                  javićemo ti se sa konkretnim zadacima — temama, materijalima
                  i smernicama za način na koji si izabrao/la da učestvuješ.
                </p>
                <p>
                  Do tada ništa ne moraš da radiš. Kad kampanja krene, dobićeš
                  sve što ti treba na kontakt koji si ostavio/la.
                </p>
              </div>

              <div className="mt-10 border-t border-slate-200 pt-8 text-center">
                <h2 className="font-display text-lg font-semibold text-slate-900">
                  Pozovi još nekoga
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                  Svaki novi čvor širi domet mreže. Podeli link sa ljudima koji
                  bi želeli da se uključe.
                </p>
                <ShareButtons className="mt-5" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
