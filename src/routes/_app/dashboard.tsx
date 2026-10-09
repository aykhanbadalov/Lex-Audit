import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useMarkAllRead, useMarkRead, useNotifications, useTaxCalendar } from "@/features/dashboard/api";
import { PageHeader } from "@/shared/components/PageHeader";
import { formatDate, formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t, i18n } = useTranslation();
  const name = useAuthStore((state) => state.user?.name ?? "");
  const tag = localeTag(i18n.language);
  const today = new Date().toISOString().slice(0, 10);
  const notifications = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const calendar = useTaxCalendar(today);

  return (
    <>
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcome", { name })} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
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
