import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useAuthStore } from "@/shared/stores/authStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/shared/ui/card";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const name = useAuthStore((state) => state.user?.name ?? "");
  return (
    <RequirePermission permission="dashboard:view">
      <PageHeader title={t("dashboard.title")} description={t("dashboard.welcome", { name })} />
      <Card>
        <CardHeader>
          <CardTitle>{t("dashboard.overview")}</CardTitle>
          <CardDescription>{t("dashboard.placeholder")}</CardDescription>
        </CardHeader>
        <CardContent />
      </Card>
    </RequirePermission>
  );
}
