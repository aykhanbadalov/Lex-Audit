import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import type { InvoiceDetail } from "../api";
import { fieldIdFor } from "../form";
import { describeIssue, sortIssues } from "../issueText";

const ICONS = {
  error: { Icon: CircleAlert, className: "text-destructive" },
  warning: { Icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400" },
} as const;

export function IssuesPanel({ detail }: { detail: InvoiceDetail }) {
  const { t } = useTranslation();
  const issues = sortIssues(detail.issues);

  function focusField(id: string | null) {
    if (!id) return;
    const element = document.getElementById(id);
    element?.scrollIntoView({ block: "center" });
    element?.focus();
  }

  return (
    <section aria-labelledby="issues-heading" className="space-y-2">
      <h2 id="issues-heading" className="text-lg font-semibold">
        {t("invoices.issues.title")}
      </h2>
      {issues.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" aria-hidden="true" />
          {t("invoices.issues.none")}
        </p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => {
            const { Icon, className } = ICONS[issue.severity];
            const { title, detail: extra } = describeIssue(t, issue);
            const target = fieldIdFor(issue.field, issue.lineNo);
            return (
              <li key={issue.id} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p>
                    <span className="sr-only">{t(`invoices.severity.${issue.severity}`)}: </span>
                    {title}
                  </p>
                  {extra ? <p className="text-xs text-muted-foreground">{extra}</p> : null}
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {target ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs underline"
                        onClick={() => focusField(target)}
                      >
                        {t("invoices.issues.goToField")}
                      </Button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
