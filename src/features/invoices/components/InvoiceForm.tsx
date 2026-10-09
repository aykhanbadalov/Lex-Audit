import { zodResolver } from "@hookform/resolvers/zod";
import { useBlocker } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { MoneyText } from "@/shared/components/MoneyText";
import { cn } from "@/shared/lib/cn";
import type { Currency } from "@/shared/lib/money";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { useAccounts, useTaxRates, useUpdateInvoice, useValidateInvoice, type InvoiceDetail } from "../api";
import { DECIMAL_INPUT, toFormValues, toUpdate, type InvoiceFormValues } from "../form";

const CURRENCIES: Currency[] = ["AZN", "USD", "EUR", "RUB", "TRY"];
const LOW_CONFIDENCE_BELOW = 0.85;

interface InvoiceFormProps {
  detail: InvoiceDetail;
  /** Writer permission AND an invoice state that still allows corrections. */
  canEdit: boolean;
}

export function InvoiceForm({ detail, canEdit }: InvoiceFormProps) {
  const { t } = useTranslation();
  const taxRates = useTaxRates();
  const accounts = useAccounts();
  const update = useUpdateInvoice(detail.id);
  const validate = useValidateInvoice(detail.id);
  const accountCodes = useMemo(
    () => (accounts.data ? new Set(accounts.data.map((account) => account.code)) : null),
    [accounts.data],
  );

  const schema = z.object({
    direction: z.enum(["purchase", "sales"]),
    number: z.string().max(64, { error: t("invoices.form.tooLong") }),
    issueDate: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, { error: t("invoices.form.dateInvalid") }),
    counterpartyName: z.string().max(255, { error: t("invoices.form.tooLong") }),
    counterpartyVoen: z.string().max(10, { error: t("invoices.form.voenTooLong") }),
    currency: z.enum(["AZN", "USD", "EUR", "RUB", "TRY"]),
    lines: z
      .array(
        z.object({
          lineId: z.string().nullable(),
          description: z
            .string()
            .trim()
            .min(1, { error: t("invoices.form.descriptionRequired") })
            .max(500, { error: t("invoices.form.tooLong") }),
          quantity: z
            .string()
            .trim()
            .regex(DECIMAL_INPUT, { error: t("invoices.form.decimalInvalid") }),
          unitPrice: z
            .string()
            .trim()
            .regex(DECIMAL_INPUT, { error: t("invoices.form.decimalInvalid") }),
          vatRateCode: z.string().min(1, { error: t("invoices.form.rateRequired") }),
          accountFinal: z.string().refine((value) => !value.trim() || !accountCodes || accountCodes.has(value.trim()), {
            error: t("invoices.form.accountUnknown"),
          }),
        }),
      )
      .min(1, { error: t("invoices.form.linesRequired") }),
  });

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<InvoiceFormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(detail) });
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });

  // Leaving with unsaved corrections would silently lose them.
  const blocker = useBlocker({ shouldBlockFn: () => isDirty, enableBeforeUnload: () => isDirty, withResolver: true });

  async function onSubmit(values: InvoiceFormValues) {
    try {
      const saved = await update.mutateAsync(toUpdate(values));
      reset(toFormValues(saved));
    } catch {
      // The hook shows an error toast; the form keeps what was typed.
    }
  }

  const lowConfidence = (field: string): ReactNode => {
    const value = detail.fieldConfidence[field];
    return value !== undefined && value < LOW_CONFIDENCE_BELOW ? (
      <Badge tone="warning" className="ml-2 font-normal">
        {t("invoices.form.checkThis", { percent: Math.round(value * 100) })}
      </Badge>
    ) : null;
  };
  const rates = taxRates.data ?? [];
  const error = (message?: string) => (message ? <p className="text-xs text-destructive">{message}</p> : null);
  const watched = useWatch({ control, name: "lines" });

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6" aria-label={t("invoices.form.label")}>
      <fieldset disabled={!canEdit || isSubmitting} className="space-y-4">
        <legend className="sr-only">{t("invoices.form.label")}</legend>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="field-number">
              {t("invoices.fields.number")}
              {lowConfidence("number")}
            </Label>
            <Input id="field-number" aria-invalid={Boolean(errors.number)} {...register("number")} />
            {error(errors.number?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-issueDate">
              {t("invoices.fields.issueDate")}
              {lowConfidence("issueDate")}
            </Label>
            <Input
              id="field-issueDate"
              type="date"
              aria-invalid={Boolean(errors.issueDate)}
              {...register("issueDate")}
            />
            {error(errors.issueDate?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-counterpartyName">
              {t("invoices.fields.counterpartyName")}
              {lowConfidence("counterpartyName")}
            </Label>
            <Input
              id="field-counterpartyName"
              aria-invalid={Boolean(errors.counterpartyName)}
              {...register("counterpartyName")}
            />
            {error(errors.counterpartyName?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-counterpartyVoen">
              {t("invoices.fields.counterpartyVoen")}
              {lowConfidence("counterpartyVoen")}
            </Label>
            <Input
              id="field-counterpartyVoen"
              inputMode="numeric"
              aria-invalid={Boolean(errors.counterpartyVoen)}
              {...register("counterpartyVoen")}
            />
            {error(errors.counterpartyVoen?.message)}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-direction">{t("invoices.fields.direction")}</Label>
            <Select id="field-direction" {...register("direction")}>
              <option value="purchase">{t("invoices.direction.purchase")}</option>
              <option value="sales">{t("invoices.direction.sales")}</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-currency">
              {t("invoices.fields.currency")}
              {lowConfidence("currency")}
            </Label>
            <Select id="field-currency" {...register("currency")}>
              {CURRENCIES.map((currency) => (
                <option key={currency} value={currency}>
                  {currency}
                </option>
              ))}
            </Select>
          </div>
        </div>

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
          {errors.lines?.message ? error(errors.lines.message) : null}

          <ol className="space-y-3">
            {fields.map((field, index) => {
              const saved = detail.lines.find((line) => line.id === watched[index]?.lineId);
              const suggestion = saved?.accountSuggestion;
              const account = watched[index]?.accountFinal ?? "";
              const lineErrors = errors.lines?.[index];
              return (
                <li key={field.id} className="space-y-3 rounded-lg border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t("invoices.lines.line", { number: index + 1 })}</span>
                    {canEdit ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={fields.length === 1}
                        aria-label={t("invoices.lines.remove", { number: index + 1 })}
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    ) : null}
                  </div>
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
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`field-lines-${index}-quantity`}>{t("invoices.lines.quantity")}</Label>
                      <Input
                        id={`field-lines-${index}-quantity`}
                        inputMode="decimal"
                        aria-invalid={Boolean(lineErrors?.quantity)}
                        {...register(`lines.${index}.quantity`)}
                      />
                      {error(lineErrors?.quantity?.message)}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`field-lines-${index}-unitPrice`}>{t("invoices.lines.unitPrice")}</Label>
                      <Input
                        id={`field-lines-${index}-unitPrice`}
                        inputMode="decimal"
                        aria-invalid={Boolean(lineErrors?.unitPrice)}
                        {...register(`lines.${index}.unitPrice`)}
                      />
                      {error(lineErrors?.unitPrice?.message)}
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor={`field-lines-${index}-vatRateCode`}>{t("invoices.lines.vatRate")}</Label>
                      <Select id={`field-lines-${index}-vatRateCode`} {...register(`lines.${index}.vatRateCode`)}>
                        {rates.length === 0 ? (
                          <option value={watched[index]?.vatRateCode}>{watched[index]?.vatRateCode}</option>
                        ) : null}
                        {rates.map((rate) => (
                          <option key={rate.code} value={rate.code}>
                            {rate.label}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-3">
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
                            code: suggestion.code,
                            name: suggestion.name,
                            percent: Math.round(suggestion.confidence * 100),
                          })}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() =>
                              setValue(`lines.${index}.accountFinal`, suggestion.code, { shouldDirty: true })
                            }
                          >
                            {t("invoices.lines.accept")}
                          </Button>
                        </p>
                      ) : null}
                    </div>
                    <dl
                      className={cn("grid grid-cols-3 gap-2 text-xs sm:col-span-3", isDirty && "opacity-50")}
                      aria-label={t("invoices.lines.computed")}
                    >
                      {(["net", "vat", "gross"] as const).map((key) => (
                        <div key={key}>
                          <dt className="text-muted-foreground">{t(`invoices.totals.${key}`)}</dt>
                          <dd>{saved ? <MoneyText amount={saved[key]} currency={detail.currency} /> : "—"}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                </li>
              );
            })}
          </ol>
          <datalist id="accounts-list">
            {accounts.data?.map((account) => (
              <option key={account.code} value={account.code}>
                {account.name}
              </option>
            ))}
          </datalist>

          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                append({
                  lineId: null,
                  description: "",
                  quantity: "1",
                  unitPrice: "0",
                  vatRateCode: rates[0]?.code ?? "",
                  accountFinal: "",
                })
              }
            >
              <Plus className="size-4" aria-hidden="true" />
              {t("invoices.lines.add")}
            </Button>
          ) : null}
        </div>
      </fieldset>

      <Totals detail={detail} stale={isDirty} />

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

function Totals({ detail, stale }: { detail: InvoiceDetail; stale: boolean }) {
  const { t } = useTranslation();
  const declared = detail.declaredTotals;
  return (
    <section aria-labelledby="totals-heading" className={cn("space-y-2", stale && "opacity-60")}>
      <h2 id="totals-heading" className="text-lg font-semibold">
        {t("invoices.totals.title")}
      </h2>
      <dl className="grid grid-cols-3 gap-4 rounded-lg border bg-card p-4 text-sm">
        {(["net", "vat", "gross"] as const).map((key) => (
          <div key={key}>
            <dt className="text-muted-foreground">{t(`invoices.totals.${key}`)}</dt>
            <dd className={cn("text-base font-medium", key === "gross" && "text-lg font-semibold")}>
              <MoneyText amount={detail[`${key}Total`]} currency={detail.currency} />
            </dd>
          </div>
        ))}
      </dl>
      {declared ? (
        <p className="text-xs text-muted-foreground">
          {t("invoices.totals.printed")}: <MoneyText amount={declared.gross} currency={detail.currency} />
        </p>
      ) : null}
      {stale ? <p className="text-xs">{t("invoices.totals.stale")}</p> : null}
    </section>
  );
}
