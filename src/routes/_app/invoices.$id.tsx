import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { AskAssistantLink } from "@/features/assistant/components/AskAssistantLink";
import { useInvoice, type InvoiceDetail } from "@/features/invoices/api";
import { InvoiceForm } from "@/features/invoices/components/InvoiceForm";
import { InvoicePreview } from "@/features/invoices/components/InvoicePreview";
import { InvoiceStatusBadge } from "@/features/invoices/components/InvoiceStatusBadge";
import { IssuesPanel } from "@/features/invoices/components/IssuesPanel";
import { JournalProposal } from "@/features/invoices/components/JournalProposal";
import { isEditable } from "@/features/invoices/filters";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/invoices/$id")({
  component: InvoiceDetailPage,
});

function InvoiceDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="invoices:read">
      <InvoiceDetailContent />
    </RequirePermission>
  );
}

function BackLink() {
  const { t } = useTranslation();
  // Return to the list as the user left it; a direct visit has no list state, so no filters are applied.
  const listSearch = useLocation({ select: (location) => location.state.fromInvoicesSearch });
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/invoices" search={listSearch ?? {}}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("invoices.back")}
      </Link>
    </Button>
  );
}

function InvoiceDetailContent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const invoice = useInvoice(id);

  if (invoice.isPending) {
    return (
      <>
        <BackLink />
        <LoadingState />
      </>
    );
  }
  if (invoice.isError) {
    return (
      <>
        <BackLink />
        {invoice.error instanceof ApiError && invoice.error.code === "NOT_FOUND" ? (
          <EmptyState icon={FileQuestion} title={t("invoices.notFound")} description={t("invoices.notFoundHint")} />
        ) : (
          <ErrorState message={invoice.error.message} onRetry={() => void invoice.refetch()} />
        )}
      </>
    );
  }
  return (
    <>
      <BackLink />
      <InvoiceView detail={invoice.data} />
    </>
  );
}

function InvoiceView({ detail }: { detail: InvoiceDetail }) {
  const { t } = useTranslation();
  const canWrite = usePermission("invoices:write");
  const canEdit = canWrite && isEditable(detail.status);
  const confidence =
    detail.extractionConfidence === null ? null : Math.round(Number(detail.extractionConfidence) * 100);

  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={detail.status} />
          <Badge tone="outline">{t(`invoices.direction.${detail.direction}`)}</Badge>
          {confidence !== null && Number.isFinite(confidence) ? (
            <span className="text-xs text-muted-foreground">{t("invoices.confidence", { percent: confidence })}</span>
          ) : null}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight break-words">{detail.number || t("invoices.noNumber")}</h1>
        <p className="text-sm text-muted-foreground">
          {detail.counterparty?.name}
          {detail.counterparty?.voen ? ` · VÖEN ${detail.counterparty.voen}` : ""}
        </p>
      </header>

      <div>
        <AskAssistantLink
          resource={{ type: "invoice", id: detail.id, title: detail.number || t("invoices.noNumber") }}
        />
      </div>

      {detail.status === "posted" ? (
        <p className="text-sm text-muted-foreground">{t("invoices.locked.posted")}</p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <aside aria-label={t("invoices.preview.title")} className="order-2 lg:sticky lg:top-4 lg:order-1 lg:self-start">
          <h2 className="mb-2 text-lg font-semibold">{t("invoices.preview.title")}</h2>
          <InvoicePreview invoiceId={detail.id} fileName={detail.number} />
        </aside>

        <div className="order-1 space-y-8 lg:order-2">
          <IssuesPanel detail={detail} />
          <InvoiceForm key={`${detail.id}-${detail.updatedAt}`} detail={detail} canEdit={canEdit} />
          <JournalProposal detail={detail} canWrite={canWrite} />
        </div>
      </div>
    </article>
  );
}
