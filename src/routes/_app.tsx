import { createFileRoute, Link, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import { signOut } from "@/api/session";
import { NAV_GROUPS, visibleNavItems } from "@/app/navigation";
import { Logo } from "@/shared/components/Logo";
import { DemoBanner } from "@/shared/components/DemoBanner";
import { LanguageSwitcher } from "@/shared/components/LanguageSwitcher";
import { ThemeToggle } from "@/shared/components/ThemeToggle";
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
  const items = visibleNavItems(user?.permissions ?? []);

  async function logout() {
    await signOut();
    await navigate({ to: "/login", search: {} });
  }

  return (
    <div className="grid min-h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[auto_1fr] md:grid-cols-[15rem_minmax(0,1fr)] md:grid-rows-none">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-background p-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        {t("nav.skip")}
      </a>

      <aside className="min-w-0 border-b border-sidebar-border bg-sidebar text-sidebar-foreground md:border-r md:border-b-0">
        <div className="flex flex-col gap-4 p-4 md:sticky md:top-0 md:h-dvh md:overflow-y-auto">
          <p className="flex items-center gap-2 text-lg font-semibold">
            <Logo />
            {t("app.name")}
          </p>
          <nav aria-label={t("nav.main")} className="flex gap-4 overflow-x-auto md:flex-col md:gap-5">
            {NAV_GROUPS.map((group) => {
              const groupItems = items.filter((item) => item.group === group);
              if (groupItems.length === 0) return null;
              return (
                <ul key={group} className="flex gap-1 md:flex-col" aria-label={t(`nav.groups.${group}`)}>
                  {groupItems.map(({ to, labelKey, icon: Icon }) => (
                    <li key={to}>
                      <Link
                        to={to}
                        className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm whitespace-nowrap hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:outline-ring"
                        activeProps={{ className: "bg-sidebar-accent font-medium", "aria-current": "page" }}
                      >
                        <Icon className="size-4 shrink-0" aria-hidden="true" />
                        {t(labelKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              );
            })}
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <DemoBanner />
        <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <span className="min-w-0 truncate text-sm text-muted-foreground">{user?.name}</span>
            <Button variant="outline" size="sm" onClick={logout}>
              <LogOut className="size-4" aria-hidden="true" />
              {t("auth.logout")}
            </Button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
