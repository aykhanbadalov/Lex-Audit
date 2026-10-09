import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, FileQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/api/errors";
import { useImport } from "@/features/integrations/api";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app/integrations/$id")({ component: ImportPage });

function ImportPage() {
  return (
    <RequirePermission permission="excel:use">
      <ImportContent />
    </RequirePermission>
  );
}

function ImportContent() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const job = useImport(id);

  const back = (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/integrations">
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("integrations.back")}
      </Link>
    </Button>
  );
  if (job.isPending)
    return (
      <>
        {back}
        <LoadingState />
      </>
    );
  if (job.isError) {
    return (
      <>
        {back}
        {job.error instanceof ApiError && job.error.code === "NOT_FOUND" ? (
          <EmptyState
            icon={FileQuestion}
            title={t("integrations.notFound")}
            description={t("integrations.notFoundHint")}
          />
        ) : (
          <ErrorState message={job.error.message} onRetry={() => void job.refetch()} />
        )}
      </>
    );
  }
  const data = job.data;
  return (
    <>
      {back}
      <PageHeader
        title={t("integrations.import.title")}
        description={`${t(`integrations.source.${data.source}`, { defaultValue: data.source })} · ${data.template}`}
      />
      <p className="flex flex-wrap items-center gap-2 text-sm">
        <Badge tone="outline">{data.status}</Badge>
        <Badge tone="success">{t("integrations.preview.ok", { count: data.rowsOk })}</Badge>
        {data.rowsFailed > 0 ? (
          <Badge tone="danger">{t("integrations.preview.failed", { count: data.rowsFailed })}</Badge>
        ) : null}
      </p>
      {data.error ? (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {data.error}
        </p>
      ) : null}
      {data.approvalId ? (
        <p className="mt-3 text-sm">
          {t("integrations.waiting")}{" "}
          <Link to="/approvals" search={{ status: "all" }} className="font-medium text-primary hover:underline">
            {t("assistant.openApprovals")}
          </Link>
        </p>
      ) : null}
    </>
  );
}
