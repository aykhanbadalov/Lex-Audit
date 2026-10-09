import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { accountName, useAccounts, useTaxRates } from "@/shared/api/referenceData";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useSaveInvoice, useValidateInvoice, type InvoiceDetail } from "../api";
import { DECIMAL_INPUT, toFormValues, toUpdate, type InvoiceFormValues } from "../form";

const CURRENCIES = ["AZN", "USD", "EUR", "RUB", "TRY"];

interface InvoiceFormProps {
  detail: InvoiceDetail;
  /** Writer permission AND an invoice state that still allows corrections. */
  canEdit: boolean;
}

export function InvoiceForm({ detail, canEdit }: InvoiceFormProps) {
  const { t, i18n } = useTranslation();
  const taxRates = useTaxRates();
  const accounts = useAccounts();
  const save = useSaveInvoice(detail.id);
  const validate = useValidateInvoice(detail.id);
  const accountCodes = useMemo(
    () => (accounts.data ? new Set(accounts.data.map((account) => account.code)) : null),
    [accounts.data],
  );

  const money = z
    .string()
    .trim()
    .regex(DECIMAL_INPUT, { error: t("invoices.form.decimalInvalid") });
  const schema = z.object({
    number: z
      .string()
      .trim()
      .min(1, { error: t("invoices.form.numberRequired") })
      .max(100, { error: t("invoices.form.tooLong") }),
    issueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, { error: t("invoices.form.dateInvalid") }),
    currency: z.string().length(3),
    net: money,
    vat: money,
    gross: money,
    lines: z.array(
      z.object({
        lineId: z.string(),
        description: z
          .string()
          .trim()
          .min(1, { error: t("invoices.form.descriptionRequired") })
          .max(1000, { error: t("invoices.form.tooLong") }),
        quantity: money,
        unitPrice: money,
        vatRateCode: z.string().min(1, { error: t("invoices.form.rateRequired") }),
        net: money,
        vat: money,
        accountFinal: z.string().refine((value) => !value.trim() || !accountCodes || accountCodes.has(value.trim()), {
          error: t("invoices.form.accountUnknown"),
        }),
      }),
    ),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InvoiceFormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(detail) });
  const watched = useWatch({ control, name: "lines" });

  // Leaving with unsaved corrections would silently lose them.
  const blocker = useBlocker({ shouldBlockFn: () => isDirty, enableBeforeUnload: () => isDirty, withResolver: true });

  async function onSubmit(values: InvoiceFormValues) {
    try {
      const saved = await save.mutateAsync(toUpdate(values));
      reset(toFormValues(saved));
    } catch {
      // The hook shows an error toast; the form keeps what was typed.
    }
  }

  const flagged = (field: string): ReactNode =>
    detail.lowConfidenceFields.includes(field) ? (
      <Badge tone="warning" className="ml-2 font-normal">
        {t("invoices.form.checkThis")}
      </Badge>
    ) : null;
  const rates = taxRates.data ?? [];
  const error = (message?: string) => (message ? <p className="text-xs text-destructive">{message}</p> : null);

  const header = (name: "number" | "issueDate" | "net" | "vat" | "gross", label: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`field-${name}`}>
        {label}
        {flagged(name)}
      </Label>
      <Input
        id={`field-${name}`}
        type={type}
        inputMode={type === "text" && name !== "number" ? "decimal" : undefined}
        aria-invalid={Boolean(errors[name])}
        {...register(name)}
      />
      {error(errors[name]?.message)}
    </div>
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6" aria-label={t("invoices.form.label")}>
      <fieldset disabled={!canEdit || isSubmitting} className="space-y-4">
        <legend className="sr-only">{t("invoices.form.label")}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          {header("number", t("invoices.fields.number"))}
          {header("issueDate", t("invoices.fields.issueDate"), "date")}
          <div className="space-y-1.5">
            <Label htmlFor="field-currency">{t("invoices.fields.currency")}</Label>
            <Select id="field-currency" {...register("currency")}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {header("net", t("invoices.totals.net"))}
          {header("vat", t("invoices.totals.vat"))}
          {header("gross", t("invoices.totals.gross"))}
        </div>
        <p className="text-xs text-muted-foreground">{t("invoices.totals.hint")}</p>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">{t("invoices.lines.title")}</h2>
          {isDirty ? (
            <p
              role="status"
              className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100"
            >
              {t("invoices.lines.unsaved")}
            </p>
          ) : null}

          <ol className="space-y-3">
            {detail.lines.map((line, index) => {
              const account = watched?.[index]?.accountFinal ?? "";
              const lineErrors = errors.lines?.[index];
              const suggestion = line.accountSuggestion;
              const suggestionName = accounts.data?.find((candidate) => candidate.code === suggestion);
              return (
                <li key={line.id} className="space-y-3 rounded-lg border bg-card p-3">
                  <span className="text-sm font-medium">{t("invoices.lines.line", { number: line.lineNo })}</span>
                  <div className="grid gap-3 sm:grid-cols-6">
                    <div className="space-y-1.5 sm:col-span-6">
                      <Label htmlFor={`field-lines-${index}-description`}>{t("invoices.lines.description")}</Label>
                      <Input
                        id={`field-lines-${index}-description`}
                        aria-invalid={Boolean(lineErrors?.description)}
                        {...register(`lines.${index}.description`)}
                      />
                      {error(lineErrors?.description?.message)}
                    </div>
                    {(
                      [
                        ["quantity", "invoices.lines.quantity"],
                        ["unitPrice", "invoices.lines.unitPrice"],
                        ["net", "invoices.totals.net"],
                        ["vat", "invoices.totals.vat"],
                      ] as const
                    ).map(([name, label]) => (
                      <div key={name} className="space-y-1.5 sm:col-span-1">
                        <Label htmlFor={`field-lines-${index}-${name}`}>{t(label)}</Label>
                        <Input
                          id={`field-lines-${index}-${name}`}
                          inputMode="decimal"
                          aria-invalid={Boolean(lineErrors?.[name])}
                          {...register(`lines.${index}.${name}`)}
                        />
                        {error(lineErrors?.[name]?.message)}
                      </div>
                    ))}
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`field-lines-${index}-vatRateCode`}>{t("invoices.lines.vatRate")}</Label>
                      <Select id={`field-lines-${index}-vatRateCode`} {...register(`lines.${index}.vatRateCode`)}>
                        {!rates.some((rate) => rate.code === line.vatRateCode) ? (
                          <option value={line.vatRateCode}>{line.vatRateCode}</option>
                        ) : null}
                        {rates.map((rate) => (
                          <option key={rate.id} value={rate.code}>
                            {rate.code} · {rate.ratePercent}%
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-6">
                      <Label htmlFor={`field-lines-${index}-accountFinal`}>{t("invoices.lines.account")}</Label>
                      <Input
                        id={`field-lines-${index}-accountFinal`}
                        list="accounts-list"
                        aria-invalid={Boolean(lineErrors?.accountFinal)}
                        {...register(`lines.${index}.accountFinal`)}
                      />
                      {error(lineErrors?.accountFinal?.message)}
                      {suggestion && !account.trim() && canEdit ? (
                        <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          {t("invoices.lines.suggestion", {
                            code: suggestion,
                            name: suggestionName ? accountName(suggestionName, i18n.language) : "",
                            percent: Math.round(Number(line.accountSuggestionConfidence ?? 0) * 100),
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => setValue(`lines.${index}.accountFinal`, suggestion, { shouldDirty: true })}
                          >
                            {t("invoices.lines.accept")}
                          </Button>
                        </p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <datalist id="accounts-list">
            {accounts.data?.map((account) => (
              <option key={account.id} value={account.code}>
                {accountName(account, i18n.language)}
              </option>
            ))}
          </datalist>
        </div>
      </fieldset>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {t("common.save")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!isDirty || isSubmitting}
            onClick={() => reset(toFormValues(detail))}
          >
            {t("invoices.form.discard")}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={isDirty || validate.isPending}
            onClick={() => validate.mutate()}
          >
            {t("invoices.form.revalidate")}
          </Button>
        </div>
      ) : null}

      <ConfirmDialog
        open={blocker.status === "blocked"}
        onOpenChange={(open) => {
          if (!open) blocker.reset?.();
        }}
        title={t("invoices.leave.title")}
        description={t("invoices.leave.description")}
        confirmLabel={t("invoices.leave.confirm")}
        destructive
        onConfirm={() => blocker.proceed?.()}
      />
    </form>
  );
}
