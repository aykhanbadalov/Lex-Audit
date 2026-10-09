import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { MoneyText } from "@/shared/components/MoneyText";
import { usePermission } from "@/shared/hooks/usePermission";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { DECIMAL_INPUT, normalizeDecimal } from "@/features/invoices/form";
import { useImportDeposit, useVatSummary, type DepositLine } from "../api";

const OPERATIONS: DepositLine["operation"][] = ["top_up", "vat_payment", "refund", "withdrawal", "other"];

interface Row {
  date: string;
  operation: DepositLine["operation"];
  amount: string;
  reference: string;
}

const emptyRow = (period: string): Row => ({ date: `${period}-01`, operation: "top_up", amount: "", reference: "" });

/**
 * The backend has no way to read a statement back yet; it only takes rows in. The balance shown comes from the
 * summary, computed by the backend from the rows it holds.
 */
export function DepositTab({ period }: { period: string }) {
  const { t } = useTranslation();
  const summary = useVatSummary(period);
  const importDeposit = useImportDeposit(period);
  const canWrite = usePermission("vat:write");
  const [rows, setRows] = useState<Row[]>([emptyRow(period)]);
  const [submitted, setSubmitted] = useState(false);

  const valid = (row: Row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && DECIMAL_INPUT.test(row.amount.trim());
  const allValid = rows.length > 0 && rows.every(valid);
  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, position) => (position === index ? { ...row, ...patch } : row)));

  return (
    <div className="space-y-6">
      <section className="space-y-1">
        <h2 className="text-sm text-muted-foreground">{t("vat.summary.depositBalance")}</h2>
        <p className="text-2xl font-semibold">
          {summary.data ? <MoneyText amount={summary.data.depositBalance ?? "0.00"} /> : "—"}
        </p>
        <p className="text-xs text-muted-foreground">{t("vat.deposit.hint")}</p>
      </section>

      {canWrite ? (
        <form
          aria-label={t("vat.deposit.formLabel")}
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            if (!allValid) return;
            importDeposit.mutate(
              rows.map((row) => ({
                date: row.date,
                operation: row.operation,
                amount: normalizeDecimal(row.amount),
                reference: row.reference.trim() || undefined,
              })),
              {
                onSuccess: () => {
                  setRows([emptyRow(period)]);
                  setSubmitted(false);
                },
              },
            );
          }}
        >
          <h2 className="text-lg font-semibold">{t("vat.deposit.importTitle")}</h2>
          <ol className="space-y-3">
            {rows.map((row, index) => (
              <li
                key={index}
                className="grid gap-3 rounded-lg border bg-card p-3 sm:grid-cols-[9rem_11rem_9rem_1fr_auto]"
              >
                <div className="space-y-1.5">
                  <Label htmlFor={`dep-date-${index}`}>{t("vat.deposit.columns.date")}</Label>
                  <Input
                    id={`dep-date-${index}`}
                    type="date"
                    value={row.date}
                    onChange={(event) => update(index, { date: event.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dep-op-${index}`}>{t("vat.deposit.columns.operation")}</Label>
                  <Select
                    id={`dep-op-${index}`}
                    value={row.operation}
                    onChange={(event) => update(index, { operation: event.target.value as Row["operation"] })}
                  >
                    {OPERATIONS.map((operation) => (
                      <option key={operation} value={operation}>
                        {t(`vat.deposit.operation.${operation}`)}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dep-amount-${index}`}>{t("vat.deposit.columns.amount")}</Label>
                  <Input
                    id={`dep-amount-${index}`}
                    inputMode="decimal"
                    value={row.amount}
                    aria-invalid={submitted && !valid(row)}
                    onChange={(event) => update(index, { amount: event.target.value })}
                  />
                  {submitted && !DECIMAL_INPUT.test(row.amount.trim()) ? (
                    <p className="text-xs text-destructive">{t("invoices.form.decimalInvalid")}</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`dep-ref-${index}`}>{t("vat.deposit.columns.reference")}</Label>
                  <Input
                    id={`dep-ref-${index}`}
                    maxLength={100}
                    value={row.reference}
                    onChange={(event) => update(index, { reference: event.target.value })}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="self-end"
                  disabled={rows.length === 1}
                  aria-label={t("vat.deposit.removeRow", { number: index + 1 })}
                  onClick={() => setRows((current) => current.filter((_, position) => position !== index))}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setRows((current) => [...current, emptyRow(period)])}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("vat.deposit.addRow")}
            </Button>
            <Button type="submit" disabled={importDeposit.isPending}>
              {t("vat.deposit.import")}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-muted-foreground">{t("vat.return.readerNote")}</p>
      )}
    </div>
  );
}
