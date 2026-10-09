import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/shared/stores/authStore";

export const Route = createFileRoute("/_app/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { t } = useTranslation();
  const name = useAuthStore((state) => state.user?.name ?? "");
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
      <p>{t("dashboard.welcome", { name })}</p>
      <p className="text-sm text-muted-foreground">{t("dashboard.placeholder")}</p>
    </section>
  );
}
