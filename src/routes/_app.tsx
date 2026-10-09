import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { isAuthenticated, useAuthStore } from "@/shared/stores/authStore";
import { Button } from "@/shared/ui/button";

export const Route = createFileRoute("/_app")({
  // Every route under /_app requires a live session; individual routes add their own permission check.
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      useAuthStore.getState().clear();
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
  },
  component: AppLayout,
});

function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  async function logout() {
    useAuthStore.getState().clear();
    await navigate({ to: "/login", search: {} });
  }

  return (
    <div className="grid min-h-dvh grid-cols-[14rem_1fr]">
      <aside className="flex flex-col gap-4 border-r border-sidebar-border bg-sidebar p-4">
        <p className="font-semibold">{t("app.name")}</p>
        <nav aria-label="Main" className="flex flex-col gap-1 text-sm">
          <Link to="/dashboard" className="rounded-md px-2 py-1.5 hover:bg-sidebar-accent [&.active]:font-medium">
            {t("nav.dashboard")}
          </Link>
        </nav>
      </aside>
      <div className="flex min-w-0 flex-col">
        <header className="flex items-center justify-end gap-3 border-b px-6 py-3">
          <LanguageSwitcher />
          <span className="text-sm text-muted-foreground">{user?.name}</span>
          <Button variant="outline" size="sm" onClick={logout}>
            {t("auth.logout")}
          </Button>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
