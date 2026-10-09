import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useVatPeriods } from "@/features/vat/api";
import { DepositTab } from "@/features/vat/components/DepositTab";
import { RatesTab } from "@/features/vat/components/RatesTab";
import { ReturnTab } from "@/features/vat/components/ReturnTab";
import { SummaryTab } from "@/features/vat/components/SummaryTab";
import { VAT_TABS, vatSearchSchema } from "@/features/vat/filters";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { formatDate, formatMonth } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { TabPanel, Tabs } from "@/shared/ui/tabs";

export const Route = createFileRoute("/_app/vat")({
  validateSearch: vatSearchSchema,
  component: VatPage,
});

function VatPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="vat:read">
      <VatPageContent />
    </RequirePermission>
  );
}

function VatPageContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const periods = useVatPeriods();
  const locale = localeTag(i18n.language);

  if (periods.isPending) return <LoadingState />;
  if (periods.isError) return <ErrorState message={periods.error.message} onRetry={() => void periods.refetch()} />;

  // An unknown period in the URL falls back to the newest one rather than showing an error.
  const period = periods.data.find((item) => item.id === search.period) ?? periods.data[0];
  const tab = search.tab ?? "summary";
  const update = (patch: Partial<typeof search>) =>
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  if (!period) return <PageHeader title={t("nav.vat")} description={t("modules.vat")} />;

  return (
    <>
      <PageHeader title={t("nav.vat")} description={t("modules.vat")} />
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="vat-period">{t("vat.period")}</Label>
          <Select id="vat-period" value={period.id} onChange={(event) => update({ period: event.target.value })}>
            {periods.data.map((item) => (
              <option key={item.id} value={item.id}>
                {formatMonth(item.id, locale)} · {t(`vat.periodStatus.${item.status}`)}
              </option>
            ))}
          </Select>
        </div>
        <p className="flex flex-wrap items-center gap-2 pb-2 text-sm text-muted-foreground">
          <Badge tone={period.status === "open" ? "info" : "success"}>{t(`vat.periodStatus.${period.status}`)}</Badge>
          {t("vat.periodInfo", {
            from: formatDate(period.from, locale),
            to: formatDate(period.to, locale),
            due: formatDate(period.dueDate, locale),
          })}
        </p>
      </div>

      <Tabs
        label={t("vat.tabsLabel")}
        idPrefix="vat"
        value={tab}
        onChange={(id) => update({ tab: id as (typeof VAT_TABS)[number] })}
        tabs={VAT_TABS.map((id) => ({ id, label: t(`vat.tab.${id}`) }))}
      />
      <TabPanel idPrefix="vat" id="summary" value={tab}>
        <SummaryTab periodId={period.id} />
      </TabPanel>
      <TabPanel idPrefix="vat" id="deposit" value={tab}>
        <DepositTab periodId={period.id} />
      </TabPanel>
      <TabPanel idPrefix="vat" id="return" value={tab}>
        <ReturnTab period={period} />
      </TabPanel>
      <TabPanel idPrefix="vat" id="rates" value={tab}>
        <RatesTab />
      </TabPanel>
    </>
  );
}
