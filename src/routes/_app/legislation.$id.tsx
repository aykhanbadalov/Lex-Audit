import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ExternalLink, Scale } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { AskAssistantLink } from "@/features/assistant/components/AskAssistantLink";
import { useLegislation, useVersionDiff, useVersionText, type LegislationVersion } from "@/features/legislation/api";
import { DiffView } from "@/features/legislation/components/DiffView";
import { legislationDetailSearchSchema } from "@/features/legislation/filters";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { StatusBadge } from "@/shared/components/StatusBadge";
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
  const doc = useLegislation(id);
  const listSearch = useLocation({ select: (location) => location.state.fromLegislationSearch });
  const tag = localeTag(i18n.language);

  const versions = doc.data?.versions ?? [];
  const current = versions[0];
  const view = search.view ?? "text";
  // Defaults: read the newest version; compare the one before it against the newest.
  const versionId = versions.some((v) => v.id === search.version) ? search.version : current?.id;
  const diffTo = versions.some((v) => v.id === search.to) ? search.to : current?.id;
  const diffFrom = versions.some((v) => v.id === search.from) ? search.from : versions[1]?.id;

  const text = useVersionText(id, view === "text" ? versionId : undefined);
  const diff = useVersionDiff(id, view === "diff" ? diffFrom : undefined, view === "diff" ? diffTo : undefined);

  function update(patch: Record<string, unknown>) {
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  }

  const describe = (version: LegislationVersion) =>
    `v${version.versionNo} · ${formatDate(version.validFrom, tag)} – ${version.validTo ? formatDate(version.validTo, tag) : t("legislation.inForce")}`;

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/legislation" search={listSearch ?? {}}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("legislation.back")}
      </Link>
    </Button>
  );

  if (doc.isPending) {
    return (
      <>
        {back}
        <LoadingState />
      </>
    );
  }
  if (doc.isError) {
    return (
      <>
        {back}
        {doc.error instanceof ApiError && doc.error.code === "NOT_FOUND" ? (
          <EmptyState icon={Scale} title={t("legislation.notFound")} description={t("legislation.notFoundHint")} />
        ) : (
          <ErrorState message={doc.error.message} onRetry={() => void doc.refetch()} />
        )}
      </>
    );
  }

  const data = doc.data;
  const selectedVersion = versions.find((v) => v.id === versionId);
  const sourceUrl = selectedVersion ? safeExternalUrl(selectedVersion.sourceUrl) : null;
  const canCompare = versions.length > 1;

  return (
    <>
      {back}
      <PageHeader
        title={data.title}
        description={`${t(`legislation.type.${data.type}`)} · ${t("legislation.adopted", { date: formatDate(data.adoptedAt, tag) })}`}
        actions={
          <StatusBadge
            tone={data.status === "in_force" ? "success" : "danger"}
            label={t(`legislation.status.${data.status}`)}
          />
        }
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
              <Select id="version" value={versionId} onChange={(event) => update({ version: event.target.value })}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
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

          {text.isPending ? (
            <LoadingState />
          ) : text.isError ? (
            <ErrorState message={text.error.message} onRetry={() => void text.refetch()} />
          ) : (
            <ol className="space-y-4">
              {text.data.articles.map((article) => (
                <li key={article.ref} id={`article-${article.ref}`} className="rounded-lg border bg-card p-4">
                  <h3 className="mb-2 font-medium">
                    {t("legislation.article", { ref: article.ref })}. {article.title}
                  </h3>
                  <p className="text-sm leading-relaxed">{article.text}</p>
                </li>
              ))}
            </ol>
          )}
        </section>
      ) : (
        <section aria-label={t("legislation.tab.diff")} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">{t("legislation.compareFrom")}</Label>
              <Select id="from" value={diffFrom} onChange={(event) => update({ from: event.target.value })}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {describe(version)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">{t("legislation.compareTo")}</Label>
              <Select id="to" value={diffTo} onChange={(event) => update({ to: event.target.value })}>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
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
            <DiffView articles={diff.data.articles} showUnchanged={search.showUnchanged ?? false} />
          )}
        </section>
      )}
    </>
  );
}
