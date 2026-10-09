import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStartExcelJob } from "@/features/excel/api";
import { FilePicker } from "@/shared/components/FilePicker";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/excel/")({ component: ExcelPage });

const SPREADSHEETS = ["xlsx", "xls", "csv"] as const;

function ExcelPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="excel:use">
      <ExcelPageContent />
    </RequirePermission>
  );
}

function ExcelPageContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const start = useStartExcelJob();
  const [fileId, setFileId] = useState("");
  const [dedupe, setDedupe] = useState(true);
  const [template, setTemplate] = useState<"invoices" | "journal">("invoices");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const open = (id: string) => void navigate({ to: "/excel/$id", params: { id } });

  return (
    <>
      <PageHeader title={t("nav.excel")} description={t("modules.excel")} />
      <p className="mb-6 text-sm text-muted-foreground">{t("excel.originalUntouched")}</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="excel-file" className="space-y-3 rounded-lg border bg-card p-4">
          <h2 id="excel-file" className="text-lg font-semibold">
            {t("excel.file.title")}
          </h2>
          <FilePicker
            id="excel-file-pick"
            label={t("excel.file.pick")}
            value={fileId}
            onChange={setFileId}
            extensions={SPREADSHEETS}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={dedupe}
              onChange={(event) => setDedupe(event.target.checked)}
            />
            {t("excel.file.dedupe")}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!fileId || start.isPending}
              onClick={() =>
                start.mutate({ operation: "profile", inputFileId: fileId }, { onSuccess: (job) => open(job.id) })
              }
            >
              {t("excel.file.profile")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!fileId || start.isPending}
              onClick={() =>
                start.mutate(
                  { operation: "clean", inputFileId: fileId, params: { dedupe } },
                  { onSuccess: (job) => open(job.id) },
                )
              }
            >
              {t("excel.file.clean")}
            </Button>
          </div>
        </section>

        <section aria-labelledby="excel-report" className="space-y-3 rounded-lg border bg-card p-4">
          <h2 id="excel-report" className="text-lg font-semibold">
            {t("excel.report.title")}
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="report-template">{t("excel.report.template")}</Label>
            <Select
              id="report-template"
              value={template}
              onChange={(event) => setTemplate(event.target.value as typeof template)}
            >
              <option value="invoices">{t("excel.report.invoices")}</option>
              <option value="journal">{t("excel.report.journal")}</option>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="report-from">{t("news.filters.from")}</Label>
              <Input
                id="report-from"
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setFrom(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="report-to">{t("news.filters.to")}</Label>
              <Input
                id="report-to"
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setTo(event.target.value)}
              />
            </div>
          </div>
          <Button
            type="button"
            disabled={!from || !to || start.isPending}
            onClick={() =>
              start.mutate(
                { operation: "report", params: { template, from, to } },
                { onSuccess: (job) => open(job.id) },
              )
            }
          >
            {t("excel.report.create")}
          </Button>
        </section>
      </div>
    </>
  );
}
