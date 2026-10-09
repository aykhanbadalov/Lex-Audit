import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ModelsTab } from "@/features/admin/components/ModelsTab";
import { RatesTab } from "@/features/admin/components/RatesTab";
import { RolesTab } from "@/features/admin/components/RolesTab";
import { SourcesTab } from "@/features/admin/components/SourcesTab";
import { UsersTab } from "@/features/admin/components/UsersTab";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { useAuthStore } from "@/shared/stores/authStore";
import { TabPanel, Tabs } from "@/shared/ui/tabs";

const ADMIN_TABS = ["users", "roles", "sources", "rates", "models"] as const;
type AdminTab = (typeof ADMIN_TABS)[number];

/** Each tab asks for what the backend asks for: users and roles for their own permission, the rest for the platform. */
const NEEDS: Record<AdminTab, string> = {
  users: "users:read",
  roles: "roles:read",
  sources: "platform:admin",
  rates: "platform:admin",
  models: "platform:admin",
};

export const Route = createFileRoute("/_app/admin")({
  validateSearch: z.object({ tab: z.enum(ADMIN_TABS).catch("users") }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <RequirePermission anyOf={["users:read", "roles:read", "platform:admin"]}>
      <AdminContent />
    </RequirePermission>
  );
}

function AdminContent() {
  const { t } = useTranslation();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const permissions = useAuthStore((state) => (state.user?.permissions ?? []) as readonly string[]);
  const visible = ADMIN_TABS.filter((id) => permissions.includes(NEEDS[id]));
  const current = visible.includes(tab) ? tab : (visible[0] ?? "users");
  return (
    <>
      <PageHeader title={t("nav.admin")} description={t("modules.admin")} />
      <Tabs
        label={t("admin.tabsLabel")}
        idPrefix="admin"
        value={current}
        onChange={(id) => void navigate({ search: { tab: id as AdminTab }, replace: true })}
        tabs={visible.map((id) => ({ id, label: t(`admin.tab.${id}`) }))}
      />
      <TabPanel idPrefix="admin" id="users" value={current}>
        <UsersTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="roles" value={current}>
        <RolesTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="sources" value={current}>
        <SourcesTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="rates" value={current}>
        <RatesTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="models" value={current}>
        <ModelsTab />
      </TabPanel>
    </>
  );
}
