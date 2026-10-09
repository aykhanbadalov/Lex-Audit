import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface AiNoticeProps {
  modelVersion?: string;
  children: ReactNode;
}

/**
 * Wraps anything produced by a model. AI output must always be visibly separate from source text,
 * and must carry a reminder that a human decides (see idea.md, "Məsuliyyət").
 */
export function AiNotice({ modelVersion, children }: AiNoticeProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-lg border border-dashed bg-muted/40 p-4" aria-label={t("ai.label")}>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5" aria-hidden="true" />
        {t("ai.label")}
        {modelVersion ? <span className="font-normal">· {modelVersion}</span> : null}
      </p>
      {children}
      <p className="mt-3 text-xs text-muted-foreground">{t("ai.disclaimer")}</p>
    </section>
  );
}
