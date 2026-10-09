import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IMPORT_SOURCES,
  readSample,
  useCommitImport,
  useExportToOneC,
  usePreviewImport,
  type ImportSource,
} from "@/features/integrations/api";
import { FilePicker } from "@/shared/components/FilePicker";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/integrations/")({ component: IntegrationsPage });

function IntegrationsPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="excel:use">
      <IntegrationsContent />
    </RequirePermission>
  );
}

function IntegrationsContent() {
  const { t } = useTranslation();
  const canCommit = usePermission("imports:commit");
  const canExport = usePermission("journal:read");
  const preview = usePreviewImport();
  const commit = useCommitImport();
  const exportOneC = useExportToOneC();
  const [source, setSource] = useState<ImportSource>("1c");
  const [fileId, setFileId] = useState("");
  const [direction, setDirection] = useState<"sales" | "purchase">("purchase");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const result = preview.data;
  const approval = commit.data;

  return (
    <>
      <PageHeader title={t("nav.integrations")} description={t("modules.integrations")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="import-heading" className="space-y-3 rounded-lg border bg-card p-4">
          <h2 id="import-heading" className="text-lg font-semibold">
            {t("integrations.import.title")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("integrations.import.hint")}</p>
          <div className="space-y-1.5">
            <Label htmlFor="import-source">{t("integrations.import.source")}</Label>
            <Select
              id="import-source"
              value={source}
              onChange={(event) => setSource(event.target.value as ImportSource)}
            >
              {IMPORT_SOURCES.map((value) => (
                <option key={value} value={value}>
                  {t(`integrations.source.${value}`)}
                </option>
              ))}
            </Select>
          </div>
          <FilePicker
            id="import-file"
            label={t("integrations.import.file")}
            value={fileId}
            onChange={setFileId}
            extensions={["xlsx", "xls", "csv", "xml"]}
          />
          {source !== "bank" ? (
            <div className="space-y-1.5">
              <Label htmlFor="import-direction">{t("integrations.import.direction")}</Label>
              <Select
                id="import-direction"
                value={direction}
                onChange={(event) => setDirection(event.target.value as typeof direction)}
              >
                <option value="purchase">{t("invoices.direction.purchase")}</option>
                <option value="sales">{t("invoices.direction.sales")}</option>
              </Select>
            </div>
          ) : null}
          <Button
            type="button"
            disabled={!fileId || preview.isPending}
            onClick={() => {
              commit.reset();
              preview.mutate({ source, fileId, defaultDirection: source === "bank" ? undefined : direction });
            }}
          >
            {t("integrations.import.preview")}
          </Button>
        </section>

        {canExport ? (
          <section aria-labelledby="export-heading" className="space-y-3 rounded-lg border bg-card p-4">
            <h2 id="export-heading" className="text-lg font-semibold">
              {t("integrations.export.title")}
            </h2>
            <p className="text-xs text-muted-foreground">{t("integrations.export.hint")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="export-from">{t("news.filters.from")}</Label>
                <Input
                  id="export-from"
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(event) => setFrom(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-to">{t("news.filters.to")}</Label>
                <Input
                  id="export-to"
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(event) => setTo(event.target.value)}
                />
              </div>
            </div>
            <Button
              type="button"
              disabled={!from || !to || exportOneC.isPending}
              onClick={() => exportOneC.mutate({ from, to })}
            >
              {t("integrations.export.submit")}
            </Button>
            {exportOneC.data ? (
              <p role="status" className="text-sm">
                {t("integrations.export.ready", { count: exportOneC.data.entries })}{" "}
                <Link
                  to="/files/$id"
                  params={{ id: exportOneC.data.fileId }}
                  className="font-medium text-primary hover:underline"
                >
                  {t("excel.openFile")}
                </Link>
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      {result ? (
        <section aria-labelledby="preview-heading" className="mt-8 space-y-4">
          <h2 id="preview-heading" className="text-lg font-semibold">
            {t("integrations.preview.title")}
          </h2>
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <Badge tone="outline">{result.template}</Badge>
            <Badge tone="success">{t("integrations.preview.ok", { count: result.rowsOk })}</Badge>
            {result.rowsFailed > 0 ? (
              <Badge tone="danger">{t("integrations.preview.failed", { count: result.rowsFailed })}</Badge>
            ) : null}
            {result.truncated ? (
              <span className="text-xs text-muted-foreground">{t("integrations.preview.truncated")}</span>
            ) : null}
          </p>
          <p className="text-sm text-muted-foreground">{t("integrations.preview.nothingWritten")}</p>

          {result.errors.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {result.errors.map((entry) => (
                <li key={entry.row}>
                  <span className="font-medium">{t("integrations.preview.row", { row: entry.row })}:</span>{" "}
                  {entry.errors.join("; ")}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <caption className="sr-only">{t("integrations.preview.sample")}</caption>
              <tbody>
                {result.sample.map(readSample).flatMap((row, index) =>
                  row ? (
                    <tr key={index} className="border-t first:border-t-0">
                      {row.columns.map((value, column) => (
                        <td key={column} className="px-3 py-2">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ) : (
                    []
                  ),
                )}
              </tbody>
            </table>
          </div>

          {approval ? (
            <p role="status" className="text-sm">
              {t("integrations.waiting")}{" "}
              <Link to="/approvals" search={{ status: "pending" }} className="font-medium text-primary hover:underline">
                {t("assistant.openApprovals")}
              </Link>{" "}
              ·{" "}
              <Link
                to="/integrations/$id"
                params={{ id: result.importId }}
                className="font-medium text-primary hover:underline"
              >
                {t("integrations.openImport")}
              </Link>
            </p>
          ) : canCommit ? (
            <Button
              type="button"
              disabled={result.rowsOk === 0 || commit.isPending}
              onClick={() => commit.mutate(result.importId)}
            >
              {t("integrations.commit")}
            </Button>
          ) : null}
        </section>
      ) : null}
    </>
  );
}
