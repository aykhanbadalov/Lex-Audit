import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ModelsTab } from "@/features/admin/components/ModelsTab";
import { RatesTab } from "@/features/admin/components/RatesTab";
import { SourcesTab } from "@/features/admin/components/SourcesTab";
import { UsersTab } from "@/features/admin/components/UsersTab";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { TabPanel, Tabs } from "@/shared/ui/tabs";

const ADMIN_TABS = ["users", "sources", "rates", "models"] as const;

export const Route = createFileRoute("/_app/admin")({
  validateSearch: z.object({ tab: z.enum(ADMIN_TABS).catch("users") }),
  component: AdminPage,
});

function AdminPage() {
  return (
    <RequirePermission permission="admin:manage">
      <AdminContent />
    </RequirePermission>
  );
}

function AdminContent() {
  const { t } = useTranslation();
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  return (
    <>
      <PageHeader title={t("nav.admin")} description={t("modules.admin")} />
      <Tabs
        label={t("admin.tabsLabel")}
        idPrefix="admin"
        value={tab}
        onChange={(id) => void navigate({ search: { tab: id as (typeof ADMIN_TABS)[number] }, replace: true })}
        tabs={ADMIN_TABS.map((id) => ({ id, label: t(`admin.tab.${id}`) }))}
      />
      <TabPanel idPrefix="admin" id="users" value={tab}>
        <UsersTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="sources" value={tab}>
        <SourcesTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="rates" value={tab}>
        <RatesTab />
      </TabPanel>
      <TabPanel idPrefix="admin" id="models" value={tab}>
        <ModelsTab />
      </TabPanel>
    </>
  );
}
