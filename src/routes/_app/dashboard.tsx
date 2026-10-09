import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Clock3, Files, Gauge, GitCompareArrows, Receipt, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useMarkAllRead, useMarkRead, useNotifications, useTaxCalendar } from "@/features/dashboard/api";
import { useApprovals } from "@/features/approvals/api";
import { dashboardSnapshot } from "@/mocks/fixtures/dashboard";
import { PageHeader } from "@/shared/components/PageHeader";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { usePermission } from "@/shared/hooks/usePermission";

const metricIcons = { invoices: Receipt, vat: Gauge, reconciliation: GitCompareArrows, files: Files } as const;
const toneClass = { success: "bg-emerald-500", warning: "bg-amber-500", info: "bg-sky-500" } as const;

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const name = useAuthStore((state) => state.user?.name ?? "");
  const tag = localeTag(i18n.language);
  const today = new Date().toISOString().slice(0, 10);
  const notifications = useNotifications();
  const approvals = useApprovals();
  const canSeeApprovals = usePermission("approvals:read");
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const calendar = useTaxCalendar(today);
  const pendingApprovals = (approvals.data ?? []).filter((item) => item.status === "pending").slice(0, 3);

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcome", { name })} />
      <div className="mb-6 space-y-6">
        <p className="text-xs text-muted-foreground">{t("dashboard.demoSnapshotNote")}</p>
        <section aria-label={t("dashboard.metricsTitle")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {dashboardSnapshot.metrics.map((metric) => {
            const Icon = metricIcons[metric.key];
            return (
              <Link
                key={metric.key}
                to={metric.href as never}
                className="group rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Card className="h-full transition-colors group-hover:border-primary/40">
                  <CardContent className="flex items-start justify-between gap-3 p-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{t(`dashboard.metric.${metric.key}`)}</p>
                      <p className="mt-2 text-2xl font-semibold tracking-tight">{metric.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{metric.detail}</p>
                    </div>
                    <span className="rounded-lg bg-muted p-2 text-muted-foreground">
                      <Icon className="size-4" aria-hidden="true" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </section>
        <div className="grid gap-4 xl:grid-cols-5">
          <Card className="xl:col-span-3">
            <CardHeader>
              <CardTitle>{t("dashboard.activityTitle")}</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="divide-y">
                {dashboardSnapshot.activity.map((item) => (
                  <li key={item.id}>
                    <Link to={item.href as never} className="flex items-start gap-3 py-3 hover:bg-muted/40">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${toneClass[item.tone]}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">{item.title}</span>
                        <span className="text-xs text-muted-foreground">{item.detail}</span>
                      </span>
                      <span className="text-xs text-muted-foreground">{item.at}</span>
                    </Link>
                  </li>
                ))}
              </ol>
              <Link
                to="/audit-log"
                className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                {t("dashboard.viewActivity")} <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
          <Card className="xl:col-span-2">
            <CardHeader className="flex-row items-center gap-2">
              <ShieldAlert className="size-5 text-muted-foreground" />
              <CardTitle>{t("dashboard.riskTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dashboardSnapshot.risks.map((risk) => (
                <Link key={risk.id} to={risk.href as never} className="block rounded-lg border p-3 hover:bg-muted/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{risk.title}</span>
                    <Badge tone={risk.level === "high" ? "danger" : risk.level === "medium" ? "warning" : "neutral"}>
                      {t(`dashboard.risk.${risk.level}`)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{risk.detail}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
        {canSeeApprovals ? (
          <Card>
            <CardHeader className="flex-row items-center gap-2">
              <Clock3 className="size-5 text-muted-foreground" />
              <CardTitle>{t("dashboard.approvalsTitle")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {approvals.isPending ? (
                <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
              ) : pendingApprovals.length ? (
                pendingApprovals.map((item) => (
                  <Link
                    key={item.id}
                    to="/approvals"
                    search={{ status: "pending" }}
                    className="block rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{t(`approvals.kind.${item.kind}`)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.resourceRef}</p>
                  </Link>
                ))
              ) : (
                dashboardSnapshot.approvals.map((item) => (
                  <Link
                    key={item.id}
                    to="/approvals"
                    search={{ status: "pending" }}
                    className="block rounded-lg border p-3 hover:bg-muted/50"
                  >
                    <p className="text-sm font-medium">{item.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
                  </Link>
                ))
              )}
              <Link
                to="/approvals"
                search={{ status: "pending" }}
                className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary hover:underline"
              >
                {t("dashboard.viewApprovals")} <ArrowRight className="size-4" />
              </Link>
            </CardContent>
          </Card>
        ) : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2">
              {t("dashboard.notifications")}
              {notifications.data && notifications.data.unreadCount > 0 ? (
                <Badge tone="info">{t("dashboard.unread", { count: notifications.data.unreadCount })}</Badge>
              ) : null}
            </CardTitle>
            {notifications.data && notifications.data.unreadCount > 0 ? (
              <Button size="sm" variant="outline" disabled={markAll.isPending} onClick={() => markAll.mutate()}>
                {t("dashboard.markAllRead")}
              </Button>
            ) : null}
          </CardHeader>
          <CardContent>
            {notifications.isPending ? (
              <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
            ) : notifications.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {notifications.error.message}
              </p>
            ) : notifications.data.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noNotifications")}</p>
            ) : (
              <ul className="divide-y">
                {notifications.data.items.map((item) => (
                  <li key={item.id} className="space-y-0.5 py-2 text-sm">
                    <p className={item.read ? "" : "font-semibold"}>
                      {item.title}
                      {!item.read ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-2 h-6 px-2 text-xs"
                          onClick={() => markOne.mutate(item.id)}
                        >
                          {t("dashboard.markRead")}
                        </Button>
                      ) : null}
                    </p>
                    {item.body ? <p className="text-muted-foreground">{item.body}</p> : null}
                    <p className="text-xs text-muted-foreground">{formatDateTime(item.createdAt, tag)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.deadlines")}</CardTitle>
          </CardHeader>
          <CardContent>
            {calendar.isPending ? (
              <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
            ) : calendar.isError ? (
              <p role="alert" className="text-sm text-destructive">
                {calendar.error.message}
              </p>
            ) : calendar.data.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noDeadlines")}</p>
            ) : (
              <ul className="divide-y">
                {calendar.data.slice(0, 8).map((deadline) => (
                  <li
                    key={`${deadline.taxType}-${deadline.period}`}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
                  >
                    <span>
                      <span className="font-medium">{deadline.taxType}</span> · {deadline.period}
                    </span>
                    <span className="flex items-center gap-2">
                      {formatDate(deadline.dueDate, tag)}
                      {deadline.legalSourceId ? (
                        <Link
                          to="/legislation/$id"
                          params={{ id: deadline.legalSourceId }}
                          className="text-xs text-primary hover:underline"
                        >
                          {t("vat.rates.openSource")}
                        </Link>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
