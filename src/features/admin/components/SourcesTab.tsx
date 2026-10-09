import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { useAdminSources, useUpdateSource } from "../api";

export function SourcesTab() {
  const { t, i18n } = useTranslation();
  const sources = useAdminSources();
  const update = useUpdateSource();
  const tag = localeTag(i18n.language);

  if (sources.isPending) return <LoadingState />;
  if (sources.error) return <ErrorState message={sources.error.message} onRetry={() => void sources.refetch()} />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("admin.sources.hint")}</p>
      <ul className="divide-y rounded-lg border">
        {sources.data.map((source) => (
          <li key={source.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-48 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {source.name}
                <Badge tone="outline">{t(`admin.sources.kind.${source.kind}`)}</Badge>
                {source.failedFetches > 0 ? (
                  <Badge tone="danger">{t("admin.sources.failing", { count: source.failedFetches })}</Badge>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {source.lastFetchedAt
                  ? t("admin.sources.lastFetched", { date: formatDateTime(source.lastFetchedAt, tag) })
                  : t("admin.sources.neverFetched")}
                {source.lastError ? ` · ${source.lastError}` : ""}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={source.enabled}
                disabled={update.isPending}
                aria-label={t("admin.sources.enabledFor", { name: source.name })}
                onChange={(event) => update.mutate({ id: source.id, enabled: event.target.checked })}
              />
              {t(source.enabled ? "admin.sources.on" : "admin.sources.off")}
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
