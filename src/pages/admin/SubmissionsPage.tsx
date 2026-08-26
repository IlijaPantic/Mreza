import { useMutation, useQuery } from "@connectrpc/connect-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROLES } from "@/data/roles";
import { SOCIAL_NETWORKS } from "@/data/social-networks";
import {
  exportSubmissionsCSV,
  listSubmissions,
} from "@/gen/mreza/v1/admin-AdminService_connectquery";
import type {
  ParticipationRole,
  SocialNetwork,
} from "@/gen/mreza/v1/survey_pb";
import { getAdminErrorMessage } from "@/lib/admin-errors";
import { triggerBlobDownload } from "@/lib/download-blob";
import { formatTimestamp } from "@/lib/format-timestamp";
import { formatNetworks, formatRoles } from "@/lib/submission-labels";

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 25;

export function SubmissionsPage() {
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [networkFilter, setNetworkFilter] = useState("");
  const [largeReachOnly, setLargeReachOnly] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [pageToken, setPageToken] = useState<string | undefined>();
  const [prevTokens, setPrevTokens] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | undefined>();

  useEffect(() => {
    const id = window.setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => window.clearTimeout(id);
  }, [searchInput]);

  // Svaka promena filtera vraca na prvu stranu — kursor sa stare liste
  // ne znaci nista na novoj.
  useEffect(() => {
    setPageToken(undefined);
    setPrevTokens([]);
  }, [
    debouncedSearch,
    roleFilter,
    networkFilter,
    largeReachOnly,
    dateFrom,
    dateTo,
    pageSize,
  ]);

  // Jedan objekat filtera za listu i za izvoz — CSV tako uvek vraca tacno
  // ono sto admin vidi na ekranu.
  const filters = {
    search: debouncedSearch || undefined,
    roleFilter:
      roleFilter !== "" ? (Number(roleFilter) as ParticipationRole) : undefined,
    networkFilter:
      networkFilter !== ""
        ? (Number(networkFilter) as SocialNetwork)
        : undefined,
    largeReachOnly: largeReachOnly || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const listQ = useQuery(listSubmissions, { ...filters, pageSize, pageToken });
  const exportMut = useMutation(exportSubmissionsCSV);

  const submissions = listQ.data?.submissions ?? [];
  const nextPageToken = listQ.data?.nextPageToken;
  const totalCount = listQ.data?.totalCount;

  const hasActiveFilters =
    debouncedSearch !== "" ||
    roleFilter !== "" ||
    networkFilter !== "" ||
    largeReachOnly ||
    dateFrom !== "" ||
    dateTo !== "";

  function resetFilters() {
    setSearchInput("");
    setRoleFilter("");
    setNetworkFilter("");
    setLargeReachOnly(false);
    setDateFrom("");
    setDateTo("");
  }

  async function handleExport() {
    setExportError(undefined);
    try {
      const res = await exportMut.mutateAsync(filters);
      triggerBlobDownload(
        new Uint8Array(res.csv),
        "text/csv;charset=utf-8",
        res.filename || "mreza-prijave.csv",
      );
    } catch (err) {
      setExportError(getAdminErrorMessage(err));
    }
  }

  function handleNext() {
    if (!nextPageToken) return;
    setPrevTokens((s) => [...s, pageToken ?? ""]);
    setPageToken(nextPageToken);
  }

  function handlePrev() {
    setPrevTokens((s) => {
      const copy = [...s];
      const prev = copy.pop();
      setPageToken(prev === "" ? undefined : prev);
      return copy;
    });
  }

  const canGoPrev = prevTokens.length > 0;
  const currentPage = prevTokens.length + 1;
  const totalPages =
    totalCount !== undefined && totalCount > 0n
      ? Math.max(1, Math.ceil(Number(totalCount) / pageSize))
      : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-[200px] flex-1">
          <Label htmlFor="search">Pretraga</Label>
          <Input
            id="search"
            placeholder="Ime, prezime, email, telefon…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
          />
        </div>

        <div className="min-w-[220px]">
          <Label htmlFor="role">Uloga</Label>
          <Select
            id="role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">Sve uloge</option>
            {ROLES.map((r) => (
              <option key={r.role} value={String(r.role)}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[180px]">
          <Label htmlFor="network">Društvena mreža</Label>
          <Select
            id="network"
            value={networkFilter}
            onChange={(e) => setNetworkFilter(e.target.value)}
          >
            <option value="">Sve mreže</option>
            {SOCIAL_NETWORKS.map((n) => (
              <option key={n.network} value={String(n.network)}>
                {n.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="min-w-[150px]">
          <Label htmlFor="date-from">Od datuma</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="min-w-[150px]">
          <Label htmlFor="date-to">Do datuma</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={largeReachOnly}
            onChange={(e) => setLargeReachOnly(e.target.checked)}
            className="h-4 w-4 cursor-pointer accent-mreza-600"
          />
          Samo veći domet
        </label>

        {hasActiveFilters && (
          <Button variant="ghost" onClick={resetFilters}>
            Poništi filtere
          </Button>
        )}

        <Button
          variant="secondary"
          disabled={exportMut.isPending}
          onClick={() => void handleExport()}
        >
          {exportMut.isPending ? "Izvoz…" : "Izvezi CSV"}
        </Button>
      </div>

      {exportError && (
        <p role="alert" className="text-sm text-red-600">
          {exportError}
        </p>
      )}

      {listQ.isPending && (
        <div className="flex justify-center py-12">
          <div
            className="h-8 w-8 animate-spin rounded-full border-2 border-mreza-500 border-t-transparent"
            role="status"
            aria-label="Učitavanje"
          />
        </div>
      )}

      {listQ.isError && (
        <p role="alert" className="text-sm text-red-600">
          {getAdminErrorMessage(listQ.error)}
        </p>
      )}

      {listQ.isSuccess && (
        <>
          <Table>
            <TableHeader>
              <tr>
                <TableHead>Datum</TableHead>
                <TableHead>Ime i prezime</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Organizacija</TableHead>
                <TableHead>Uloge</TableHead>
                <TableHead>Mreže</TableHead>
                <TableHead>Domet</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {submissions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-slate-500">
                    {hasActiveFilters
                      ? "Nema prijava za izabrane filtere."
                      : "Još nema nijedne prijave."}
                  </TableCell>
                </TableRow>
              ) : (
                submissions.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => void navigate(`/admin/submissions/${s.id}`)}
                  >
                    <TableCell className="whitespace-nowrap">
                      {formatTimestamp(s.createdAt)}
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">
                      {s.name} {s.surname}
                    </TableCell>
                    <TableCell className="text-xs">
                      <span className="block">{s.phone}</span>
                      {s.email && (
                        <span className="block text-slate-500">{s.email}</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate">
                      {s.organization || <span className="text-slate-400">—</span>}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      {formatRoles(s.roles)}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      {formatNetworks(s.networks)}
                    </TableCell>
                    <TableCell>
                      {s.hasLargeReach ? (
                        <Badge variant="accent">Veći domet</Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <footer className="flex flex-col gap-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>
              {totalCount !== undefined && totalCount > 0n
                ? `Strana ${currentPage} od ${totalPages} · ukupno ${totalCount.toString()} prijava`
                : totalCount !== undefined
                  ? `Ukupno: ${totalCount.toString()}`
                  : null}
            </span>
            <div className="flex items-center gap-3">
              <label
                htmlFor="page-size"
                className="flex items-center gap-2 whitespace-nowrap"
              >
                Po strani:
                <Select
                  id="page-size"
                  value={String(pageSize)}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="!w-auto"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </label>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  disabled={!canGoPrev}
                  onClick={handlePrev}
                >
                  Prethodna
                </Button>
                <Button
                  variant="secondary"
                  disabled={!nextPageToken}
                  onClick={handleNext}
                >
                  Sledeća
                </Button>
              </div>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
