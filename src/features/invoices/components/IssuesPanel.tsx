import { Link } from "@tanstack/react-router";
import { CheckCircle2, CircleAlert, Info, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";
import type { InvoiceDetail } from "../api";
import { fieldIdFor } from "../form";
import { describeIssue, sortIssues } from "../issueText";

const ICONS = {
  error: { Icon: CircleAlert, className: "text-destructive" },
  warning: { Icon: TriangleAlert, className: "text-amber-600 dark:text-amber-400" },
  info: { Icon: Info, className: "text-sky-600 dark:text-sky-400" },
} as const;

export function IssuesPanel({ detail }: { detail: InvoiceDetail }) {
  const { t, i18n } = useTranslation();
  const issues = sortIssues(detail.issues);
  const locale = localeTag(i18n.language);

  function focusField(path: string | null) {
    if (!path) return;
    const element = document.getElementById(fieldIdFor(path));
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
            const otherId = issue.code === "DUPLICATE_INVOICE" ? issue.params.other : undefined;
            return (
              <li key={issue.id} className="flex items-start gap-3 rounded-lg border bg-card p-3 text-sm">
                <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-hidden="true" />
                <div className="min-w-0 flex-1 space-y-1">
                  <p>
                    <span className="sr-only">{t(`invoices.severity.${issue.severity}`)}: </span>
                    {describeIssue(t, issue, detail.currency, locale)}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {issue.fieldPath ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs underline"
                        onClick={() => focusField(issue.fieldPath)}
                      >
                        {t("invoices.issues.goToField")}
                      </Button>
                    ) : null}
                    {otherId ? (
                      <Link
                        to="/invoices/$id"
                        params={{ id: otherId }}
                        className="text-xs text-primary underline-offset-4 hover:underline"
                      >
                        {t("invoices.issues.openOther")}
                      </Link>
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
