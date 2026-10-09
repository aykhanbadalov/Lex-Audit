import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStartReconciliation } from "@/features/reconciliation/api";
import { SourceFields } from "@/features/reconciliation/components/SourceFields";
import { emptyDraft, isComplete, toSpec, type SourceDraft } from "@/features/reconciliation/sourceDraft";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/reconciliation/")({ component: ReconciliationPage });

function ReconciliationPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="excel:use">
      <ReconciliationContent />
    </RequirePermission>
  );
}

function ReconciliationContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = useStartReconciliation();
  const [left, setLeft] = useState<SourceDraft>(emptyDraft("file"));
  const [right, setRight] = useState<SourceDraft>(emptyDraft("invoices"));

  return (
    <>
      <PageHeader title={t("nav.reconciliation")} description={t("modules.reconciliation")} />
      <p className="mb-6 text-sm text-muted-foreground">{t("reconciliation.suggestionsOnly")}</p>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          start.mutate(
            { left: toSpec(left), right: toSpec(right) },
            { onSuccess: (result) => void navigate({ to: "/reconciliation/$id", params: { id: result.id } }) },
          );
        }}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <SourceFields idPrefix="left" legend={t("reconciliation.left")} value={left} onChange={setLeft} />
          <SourceFields idPrefix="right" legend={t("reconciliation.right")} value={right} onChange={setRight} />
        </div>
        <Button type="submit" disabled={!isComplete(left) || !isComplete(right) || start.isPending}>
          {t("reconciliation.run")}
        </Button>
      </form>
    </>
  );
}
