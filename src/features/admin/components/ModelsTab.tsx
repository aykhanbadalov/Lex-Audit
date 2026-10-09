import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import {
  useModelRegistry,
  useRegisterModel,
  useSetModelStatus,
  type ModelStatus,
  type ModelVersion,
  type NewModel,
} from "../api";

const KINDS = ["llm", "embedding", "classifier"] as const;
const STATUSES: ModelStatus[] = ["candidate", "canary", "production", "retired"];
const TONE: Record<ModelStatus, BadgeTone> = {
  production: "success",
  canary: "info",
  candidate: "neutral",
  retired: "outline",
};

export function ModelsTab() {
  const { t, i18n } = useTranslation();
  const registry = useModelRegistry();
  const setStatus = useSetModelStatus();
  const [registering, setRegistering] = useState(false);
  const [change, setChange] = useState<{ model: ModelVersion; status: ModelStatus } | null>(null);
  const tag = localeTag(i18n.language);

  if (registry.isPending) return <LoadingState />;
  if (registry.error) return <ErrorState message={registry.error.message} onRetry={() => void registry.refetch()} />;

  const { versions, serving } = registry.data;
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.models.hint")}</p>
        <Button type="button" size="sm" onClick={() => setRegistering(true)}>
          {t("admin.models.register")}
        </Button>
      </div>
      <p className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <Badge tone={serving.available ? "success" : "danger"}>
          {t(serving.available ? "admin.models.servingUp" : "admin.models.servingDown")}
        </Badge>
        {serving.available ? (
          <span className="text-xs text-muted-foreground">{serving.models.join(", ")}</span>
        ) : serving.error ? (
          <span className="text-xs">{serving.error}</span>
        ) : null}
      </p>
      <ul className="divide-y rounded-lg border">
        {versions.map((model) => (
          <li key={model.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
            <span className="min-w-40 flex-1">
              <span className="font-medium">{model.name}</span> <span className="font-mono">{model.version}</span>
              <span className="block text-xs text-muted-foreground">
                {t(`admin.models.kind.${model.kind}`)} · {formatDate(model.createdAt, tag)}
              </span>
            </span>
            <Badge tone={TONE[model.status]}>{t(`admin.models.status.${model.status}`)}</Badge>
            <Select
              aria-label={t("admin.models.changeStatus", { name: `${model.name} ${model.version}` })}
              value={model.status}
              disabled={setStatus.isPending}
              onChange={(event) => setChange({ model, status: event.target.value as ModelStatus })}
              className="w-40"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {t(`admin.models.status.${status}`)}
                </option>
              ))}
            </Select>
          </li>
        ))}
      </ul>
      {registering ? <RegisterDialog onClose={() => setRegistering(false)} /> : null}
      <ConfirmDialog
        open={change !== null && change.status !== change.model.status}
        onOpenChange={(open) => !open && setChange(null)}
        title={t("admin.models.confirmTitle", {
          name: `${change?.model.name} ${change?.model.version}`,
          status: change ? t(`admin.models.status.${change.status}`) : "",
        })}
        description={t("admin.models.confirmDescription")}
        confirmLabel={t("common.confirm")}
        destructive={change?.status === "production"}
        busy={setStatus.isPending}
        onConfirm={() => {
          if (change)
            setStatus.mutate({ id: change.model.id, status: change.status }, { onSettled: () => setChange(null) });
        }}
      />
    </>
  );
}

function RegisterDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const register = useRegisterModel();
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [kind, setKind] = useState<NewModel["kind"]>("llm");
  const [artifactUri, setArtifactUri] = useState("");
  const valid = name.trim() && version.trim() && artifactUri.trim();
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.models.register")}</DialogTitle>
          <DialogDescription>{t("admin.models.registerHint")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid)
              register.mutate(
                { name: name.trim(), version: version.trim(), kind, artifactUri: artifactUri.trim() },
                { onSuccess: onClose },
              );
          }}
        >
          {(
            [
              ["model-name", "admin.models.name", name, setName],
              ["model-version", "admin.models.version", version, setVersion],
              ["model-uri", "admin.models.artifact", artifactUri, setArtifactUri],
            ] as const
          ).map(([id, label, value, set]) => (
            <div key={id} className="space-y-1.5">
              <Label htmlFor={id}>{t(label)}</Label>
              <Input id={id} value={value} onChange={(event) => set(event.target.value)} />
            </div>
          ))}
          <div className="space-y-1.5">
            <Label htmlFor="model-kind">{t("admin.models.kindLabel")}</Label>
            <Select id="model-kind" value={kind} onChange={(event) => setKind(event.target.value as typeof kind)}>
              {KINDS.map((value) => (
                <option key={value} value={value}>
                  {t(`admin.models.kind.${value}`)}
                </option>
              ))}
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || register.isPending}>
              {t("admin.models.register")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
