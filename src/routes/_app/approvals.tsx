import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useApprovals } from "@/features/approvals/api";
import { ApprovalCard } from "@/features/approvals/components/ApprovalCard";
import { APPROVAL_STATUSES, approvalsSearchSchema, type ApprovalsSearch } from "@/features/approvals/filters";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { useAuthStore } from "@/shared/stores/authStore";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/approvals")({
  validateSearch: approvalsSearchSchema,
  component: ApprovalsPage,
});

function ApprovalsPage() {
  return (
    <RequirePermission permission="approvals:read">
      <ApprovalsContent />
    </RequirePermission>
  );
}

function ApprovalsContent() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const list = useApprovals();
  const me = useAuthStore((state) => state.user?.id);
  const canDecide = usePermission("approvals:decide");
  const items = useMemo(
    () => (list.data ?? []).filter((item) => search.status === "all" || item.status === search.status),
    [list.data, search.status],
  );
  // What waits for this person: pending, not their own request, and they may decide.
  const pendingCount = list.data
    ? canDecide
      ? list.data.filter((item) => item.status === "pending" && item.requesterId !== me).length
      : 0
    : undefined;
  const update = (patch: Partial<ApprovalsSearch>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });

  return (
    <>
      <PageHeader
        title={t("nav.approvals")}
        description={
          pendingCount === undefined ? t("modules.approvals") : t("approvals.waitingForYou", { count: pendingCount })
        }
      />
      <form className="mb-6 flex flex-wrap items-end gap-3" onSubmit={(event) => event.preventDefault()}>
        <div className="space-y-1.5">
          <Label htmlFor="ap-status">{t("approvals.filters.status")}</Label>
          <Select
            id="ap-status"
            value={search.status}
            onChange={(event) => update({ status: event.target.value as ApprovalsSearch["status"] })}
          >
            {APPROVAL_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status === "all" ? t("common.all") : t(`approvals.status.${status}`)}
              </option>
            ))}
          </Select>
        </div>
      </form>

      {list.isPending ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState message={list.error.message} onRetry={() => void list.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          title={t(search.status === "pending" ? "approvals.emptyPending" : "approvals.empty")}
          description={t("approvals.emptyHint")}
        />
      ) : (
        <ul className="space-y-4" aria-label={t("nav.approvals")}>
          {items.map((item) => (
            <li key={item.id}>
              <ApprovalCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
