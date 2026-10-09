import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { Badge } from "@/shared/ui/badge";
import { useAdminAlerts, useAdminSources, useUpdateSource } from "../api";

export function SourcesTab() {
  const { t } = useTranslation();
  const sources = useAdminSources();
  const alerts = useAdminAlerts();
  const update = useUpdateSource();

  if (sources.isPending) return <LoadingState />;
  if (sources.error) return <ErrorState message={sources.error.message} onRetry={() => void sources.refetch()} />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("admin.sources.hint")}</p>
      {alerts.data && alerts.data.length > 0 ? (
        <ul
          aria-label={t("admin.sources.alerts")}
          className="mb-4 space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
        >
          {alerts.data.map((alert) => (
            <li key={alert.id}>{alert.message}</li>
          ))}
        </ul>
      ) : null}
      <ul className="divide-y rounded-lg border">
        {sources.data.map((source) => (
          <li key={source.id} className="flex flex-wrap items-center gap-3 p-3">
            <div className="min-w-48 flex-1 space-y-0.5">
              <p className="flex flex-wrap items-center gap-2 font-medium">
                {source.name}
                <Badge tone="outline">{source.kind}</Badge>
                <Badge tone="neutral">{source.adapter}</Badge>
              </p>
              <p className="text-xs break-all text-muted-foreground">
                {source.url} · {t("admin.sources.schedule")}: <span className="font-mono">{source.fetchCron}</span>
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
