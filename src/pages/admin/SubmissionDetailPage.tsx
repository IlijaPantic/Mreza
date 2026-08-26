import { useQuery } from "@connectrpc/connect-query";
import { Link, useParams } from "react-router";

import { NetworkIcon } from "@/components/survey/NetworkIcon";
import { Badge } from "@/components/ui/badge";
import { ROLES } from "@/data/roles";
import { getNetworkLabel } from "@/data/social-networks";
import { getSubmission } from "@/gen/mreza/v1/admin-AdminService_connectquery";
import { getAdminErrorMessage } from "@/lib/admin-errors";
import { formatTimestamp } from "@/lib/format-timestamp";
import { safeExternalHref } from "@/lib/submission-labels";

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

/** Link koji nije http(s) se prikazuje kao goli tekst, ne kao klikabilan href. */
function ExternalLink({ raw }: { raw: string }) {
  const href = safeExternalHref(raw);
  if (!href) {
    return <span className="break-all text-sm text-slate-900">{raw}</span>;
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="break-all text-sm text-mreza-700 underline-offset-2 hover:underline"
    >
      {raw}
    </a>
  );
}

export function SubmissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detailQ = useQuery(getSubmission, { id: id ?? "" }, { enabled: !!id });
  const submission = detailQ.data?.submission;

  if (detailQ.isPending) {
    return (
      <div className="flex justify-center py-12">
        <div
          className="h-8 w-8 animate-spin rounded-full border-2 border-mreza-500 border-t-transparent"
          role="status"
          aria-label="Učitavanje"
        />
      </div>
    );
  }

  if (detailQ.isError || !submission) {
    return (
      <div className="space-y-4">
        <Link
          to="/admin/submissions"
          className="text-sm text-mreza-700 hover:underline"
        >
          ← Nazad na prijave
        </Link>
        <p role="alert" className="text-sm text-red-600">
          {detailQ.isError
            ? getAdminErrorMessage(detailQ.error)
            : "Prijava nije pronađena."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/admin/submissions"
        className="inline-block text-sm text-mreza-700 hover:underline"
      >
        ← Nazad na prijave
      </Link>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {submission.name} {submission.surname}
          </h2>
          {submission.hasLargeReach && (
            <Badge variant="accent">Veći domet</Badge>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          <section className="space-y-4">
            <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Kontakt
            </h3>
            <dl className="grid gap-4 sm:grid-cols-2">
              <DetailField
                label="Datum prijave"
                value={formatTimestamp(submission.createdAt)}
              />
              <DetailField label="Telefon / WhatsApp" value={submission.phone} />
              <DetailField label="Ime" value={submission.name} />
              <DetailField label="Prezime" value={submission.surname} />
              <DetailField label="Email" value={submission.email} />
              <DetailField
                label="Saglasnost"
                value={submission.gdprConsent ? "Da" : "Ne"}
              />
            </dl>
          </section>

          <section className="space-y-6">
            <div>
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Način učešća
              </h3>
              {submission.roles.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">—</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {ROLES.filter((def) =>
                    submission.roles.includes(def.role),
                  ).map((def) => (
                    <li
                      key={def.role}
                      className="rounded-lg border border-slate-100 bg-slate-50/60 p-3"
                    >
                      <p className="text-sm font-medium text-slate-900">
                        {def.label}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">
                        {def.description}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Društvene mreže
              </h3>
              {submission.networks.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">—</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {submission.networks.map((n) => (
                    <li
                      key={n}
                      className="inline-flex items-center gap-2 rounded-lg border border-mreza-200 bg-mreza-50 px-3 py-1.5 text-sm text-mreza-900"
                    >
                      <NetworkIcon network={n} className="h-4 w-4" />
                      {getNetworkLabel(n)}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className="border-b border-slate-200 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Medij / profil većeg dometa
              </h3>
              <p className="mt-3">
                {submission.largeReachUrl ? (
                  <ExternalLink raw={submission.largeReachUrl} />
                ) : (
                  <span className="text-sm text-slate-500">—</span>
                )}
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
