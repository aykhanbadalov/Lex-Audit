import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { ratePercent } from "@/shared/lib/percent";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { useModels, useRequestModelChange, type ModelVersion } from "../api";
import { RequestDialog } from "./RequestDialog";

const TASKS = ["invoice_extractor", "classifier", "assistant", "embeddings"] as const;
const TONE: Record<ModelVersion["status"], BadgeTone> = {
  active: "success",
  canary: "info",
  candidate: "neutral",
  retired: "outline",
};
const score = (value: string) => `${ratePercent(value).replace(".", ",")}%`;

export function ModelsTab() {
  const { t, i18n } = useTranslation();
  const models = useModels();
  const change = useRequestModelChange();
  const tag = localeTag(i18n.language);
  const [target, setTarget] = useState<{ model: ModelVersion; action: "release" | "rollback" } | null>(null);

  if (models.isPending) return <LoadingState />;
  if (models.error) return <ErrorState message={models.error.message} onRetry={() => void models.refetch()} />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("admin.models.hint")}</p>
      <div className="space-y-6">
        {TASKS.map((task) => {
          const versions = models.data.filter((model) => model.task === task);
          if (versions.length === 0) return null;
          return (
            <section key={task} aria-labelledby={`task-${task}`}>
              <h2 id={`task-${task}`} className="mb-2 text-base font-semibold">
                {t(`admin.models.task.${task}`)}
              </h2>
              <ul className="divide-y rounded-lg border">
                {versions.map((model) => {
                  const action = model.status === "retired" ? "rollback" : model.status === "active" ? null : "release";
                  return (
                    <li key={model.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                      <span className="w-12 font-mono font-medium">{model.version}</span>
                      <Badge tone={TONE[model.status]}>{t(`admin.models.status.${model.status}`)}</Badge>
                      {model.canaryPercent !== null ? (
                        <span className="text-xs text-muted-foreground">
                          {t("admin.models.canary", { percent: model.canaryPercent })}
                        </span>
                      ) : null}
                      <span className="flex-1 text-muted-foreground">
                        {t("admin.models.eval", { score: score(model.evalScore) })}
                        {model.previousScore
                          ? ` (${t("admin.models.was", { score: score(model.previousScore) })})`
                          : ""}
                        {" · "}
                        {formatDate(model.createdAt, tag)}
                      </span>
                      {model.pendingChange ? (
                        <Badge tone="warning">{t(`admin.models.pending.${model.pendingChange}`)}</Badge>
                      ) : action ? (
                        <Button size="sm" variant="outline" onClick={() => setTarget({ model, action })}>
                          {t(`admin.models.action.${action}`)}
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
      {target ? (
        <RequestDialog
          open
          onOpenChange={(open) => !open && setTarget(null)}
          title={t(`admin.models.dialog.${target.action}`, {
            task: t(`admin.models.task.${target.model.task}`),
            version: target.model.version,
          })}
          description={t("admin.models.dialogDescription")}
          busy={change.isPending}
          onSubmit={(reason) =>
            change.mutate({ id: target.model.id, action: target.action, reason }, { onSuccess: () => setTarget(null) })
          }
        />
      ) : null}
    </>
  );
}
