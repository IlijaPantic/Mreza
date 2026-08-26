import { useEffect, useState } from "react";

import { PublicFooter } from "@/components/PublicFooter";
import { Accent, PublicHero } from "@/components/PublicHero";
import { SurveyForm } from "@/components/survey/SurveyForm";

export function SurveyPage() {
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Mreža — Prijava za javnu kampanju";
  }, []);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6000);
    return () => window.clearTimeout(id);
  }, [toast]);

  return (
    <div className="flex min-h-screen flex-col bg-white">
      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 top-4 z-50 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg sm:inset-x-auto sm:left-1/2 sm:max-w-md sm:-translate-x-1/2"
        >
          {toast}
        </div>
      )}

      <PublicHero
        eyebrow="Javna kampanja"
        title={
          <>
            Postani <Accent>čvor</Accent> u mreži
          </>
        }
        lead="Poruka putuje onoliko daleko koliko je ljudi prenese. Prijavi se i biraj kako ćeš da učestvuješ — praviš sadržaj, deliš ga, otvaraš svoje stranice ili jednostavno razgovaraš sa ljudima oko sebe."
      />

      <main className="flex-1">
        <section className="px-4 pb-16 sm:px-6">
          {/* Kartica se penje preko donje ivice hero pojasa — vizuelno spaja
              tamni i svetli deo strane. */}
          <div className="mx-auto -mt-14 max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
              <SurveyForm onToast={setToast} />
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
