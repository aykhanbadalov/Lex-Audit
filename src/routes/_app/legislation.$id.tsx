import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { AskAssistantLink } from "@/features/assistant/components/AskAssistantLink";
import { useLegislation, useVersionDiff, useVersions, type LegislationVersion } from "@/features/legislation/api";
import { DiffView } from "@/features/legislation/components/DiffView";
import { legislationDetailSearchSchema } from "@/features/legislation/filters";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { safeExternalUrl } from "@/shared/lib/safeUrl";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/legislation/$id")({
  validateSearch: legislationDetailSearchSchema,
  component: LegislationDetailPage,
});

function LegislationDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="legislation:read">
      <LegislationDetailPageContent />
    </RequirePermission>
  );
}

function LegislationDetailPageContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const versionsQuery = useVersions(id);
  const listSearch = useLocation({ select: (location) => location.state.fromLegislationSearch });
  const tag = localeTag(i18n.language);

  // The backend lists versions newest first and names them by number.
  const versions = versionsQuery.data ?? [];
  const known = (no: number | undefined) => versions.find((v) => v.versionNo === no);
  const view = search.view ?? "text";
  // Defaults: read the newest version; compare the one before it against the newest.
  const selected = known(search.version) ?? versions[0];
  const diffTo = known(search.to)?.versionNo ?? versions[0]?.versionNo;
  const diffFrom = known(search.from)?.versionNo ?? versions[1]?.versionNo;
  // The text of a version is asked for by the day it came into force.
  const doc = useLegislation(id, view === "text" ? selected?.validFrom : undefined);
  const diff = useVersionDiff(id, view === "diff" ? diffFrom : undefined, view === "diff" ? diffTo : undefined);

  function update(patch: Record<string, unknown>) {
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  }

  const describe = (version: LegislationVersion) =>
    `v${version.versionNo} · ${formatDate(version.validFrom, tag)} - ${version.validTo ? formatDate(version.validTo, tag) : t("legislation.inForce")}`;

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/legislation" search={listSearch ?? {}}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("legislation.back")}
      </Link>
    </Button>
  );

  if (versionsQuery.isPending || doc.isPending) {
    return (
      <>
        {back}
        <LoadingState />
      </>
    );
  }
  if (versionsQuery.isError || doc.isError) {
    const failure = doc.error ?? versionsQuery.error;
    return (
      <>
        {back}
        {failure instanceof ApiError && failure.code === "NOT_FOUND" ? (
          <EmptyState icon={Scale} title={t("legislation.notFound")} description={t("legislation.notFoundHint")} />
        ) : (
          <ErrorState
            message={failure?.message ?? ""}
            onRetry={() => {
              void doc.refetch();
              void versionsQuery.refetch();
            }}
          />
        )}
      </>
    );
  }

  const data = doc.data;
  const sourceUrl = safeExternalUrl(data.version?.sourceUrl || data.sourceUrl);
  const canCompare = versions.length > 1;

  return (
    <>
      {back}
      <PageHeader
        title={data.title}
        description={`${t(`legislation.type.${data.type}`, { defaultValue: data.type })} · ${data.officialNumber} · ${t("legislation.adopted", { date: data.adoptedAt ? formatDate(data.adoptedAt, tag) : "-" })}`}
      />

      <div className="mb-4">
        <AskAssistantLink resource={{ type: "legislation", id: data.id, title: data.title }} />
      </div>

      <div role="tablist" aria-label={t("legislation.viewLabel")} className="mb-4 flex gap-1 border-b">
        {(["text", "diff"] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            type="button"
            aria-selected={view === tab}
            disabled={tab === "diff" && !canCompare}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 aria-selected:border-primary"
            onClick={() => update({ view: tab })}
          >
            {t(`legislation.tab.${tab}`)}
          </button>
        ))}
      </div>

      {view === "text" ? (
        <section aria-label={t("legislation.tab.text")} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="version">{t("legislation.version")}</Label>
              <Select
                id="version"
                value={selected?.versionNo}
                onChange={(event) => update({ version: Number(event.target.value) })}
              >
                {versions.map((version) => (
                  <option key={version.versionNo} value={version.versionNo}>
                    {describe(version)}
                  </option>
                ))}
              </Select>
            </div>
            {sourceUrl ? (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 pb-2 text-sm text-primary underline-offset-4 hover:underline"
              >
                {t("legislation.openSource")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            ) : null}
          </div>

          {/* Plain text on purpose: the text is scraped, never rendered as HTML. */}
          <div className="space-y-3 rounded-lg border bg-card p-4 text-sm leading-relaxed">
            {(data.version?.fullText ?? "")
              .split(/\n{2,}/)
              .filter(Boolean)
              .map((paragraph, index) => (
                <p key={index} className="whitespace-pre-line">
                  {paragraph}
                </p>
              ))}
          </div>
        </section>
      ) : (
        <section aria-label={t("legislation.tab.diff")} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">{t("legislation.compareFrom")}</Label>
              <Select id="from" value={diffFrom} onChange={(event) => update({ from: Number(event.target.value) })}>
                {versions.map((version) => (
                  <option key={version.versionNo} value={version.versionNo}>
                    {describe(version)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">{t("legislation.compareTo")}</Label>
              <Select id="to" value={diffTo} onChange={(event) => update({ to: Number(event.target.value) })}>
                {versions.map((version) => (
                  <option key={version.versionNo} value={version.versionNo}>
                    {describe(version)}
                  </option>
                ))}
              </Select>
            </div>
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4"
                checked={search.showUnchanged ?? false}
                onChange={(event) => update({ showUnchanged: event.target.checked || undefined })}
              />
              {t("legislation.showUnchanged")}
            </label>
          </div>

          {diffFrom === diffTo ? (
            <p className="text-sm text-muted-foreground">{t("legislation.sameVersion")}</p>
          ) : diff.isPending ? (
            <LoadingState />
          ) : diff.isError ? (
            <ErrorState message={diff.error.message} onRetry={() => void diff.refetch()} />
          ) : (
            <DiffView hunks={diff.data.hunks} showUnchanged={search.showUnchanged ?? false} />
          )}
        </section>
      )}
    </>
  );
}
