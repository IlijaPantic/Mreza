import { useEffect } from "react";
import { Link } from "react-router";

import { PublicFooter } from "@/components/PublicFooter";
import { Accent, PublicHero } from "@/components/PublicHero";

const CONSENT_TEXT =
  "Dajem saglasnost, u skladu sa Zakonom o zaštiti podataka o ličnosti, da se moji podaci obrađuju radi organizovanja i sprovođenja opisane javne kampanje, i da mogu biti prosleđeni drugom rukovaocu, obrađivaču i trećim licima uključenim u kampanju.";

/** Sta se prikuplja i zasto — mora odgovarati poljima u SurveyForm. */
const COLLECTED = [
  {
    what: "Ime i prezime",
    why: "Da znamo kome se obraćamo kad podelimo materijale i zadatke.",
  },
  {
    what: "Email i broj telefona / WhatsApp",
    why: "Jedini način da ti pošaljemo teme, materijale i smernice.",
  },
  {
    what: "Način učešća i društvene mreže",
    why: "Da ti šaljemo samo ono što odgovara načinu na koji si izabrao/la da učestvuješ.",
  },
  {
    what: "Linkovi ka profilima i stranicama",
    why: "Da procenimo domet i uskladimo sadržaj sa publikom koju već imaš.",
  },
];

export function PrivacyPage() {
  useEffect(() => {
    document.title = "Mreža — Politika privatnosti";
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHero
        eyebrow="Zaštita podataka o ličnosti"
        title={
          <>
            Politika <Accent>privatnosti</Accent>
          </>
        }
      />

      <main className="flex-1">
        <section className="px-4 pb-16 sm:px-6">
          <div className="mx-auto -mt-14 max-w-2xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
              <h2 className="font-display text-lg font-semibold text-slate-900">
                Tekst saglasnosti
              </h2>
              <p className="mt-3 leading-relaxed text-slate-700">
                {CONSENT_TEXT}
              </p>

              <h2 className="mt-10 font-display text-lg font-semibold text-slate-900">
                Šta prikupljamo
              </h2>
              <dl className="mt-4 space-y-4">
                {COLLECTED.map((item) => (
                  <div
                    key={item.what}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-4"
                  >
                    <dt className="font-medium text-slate-900">{item.what}</dt>
                    <dd className="mt-1 text-sm leading-relaxed text-slate-600">
                      {item.why}
                    </dd>
                  </div>
                ))}
              </dl>

              <h2 className="mt-10 font-display text-lg font-semibold text-slate-900">
                Tvoja prava
              </h2>
              <p className="mt-3 leading-relaxed text-slate-700">
                U svakom trenutku možeš da povučeš saglasnost i zatražiš uvid,
                ispravku ili brisanje svojih podataka. Podaci se koriste
                isključivo za potrebe ove kampanje i ne prodaju se trećim
                licima.
              </p>

              <p className="mt-10">
                <Link
                  to="/"
                  className="font-display text-sm font-semibold uppercase tracking-wide text-mreza-700 underline-offset-4 hover:underline"
                >
                  ← Nazad na prijavu
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
