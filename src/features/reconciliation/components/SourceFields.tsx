import { useTranslation } from "react-i18next";
import { FilePicker } from "@/shared/components/FilePicker";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { emptyDraft, type SourceDraft } from "../sourceDraft";

interface SourceFieldsProps {
  idPrefix: string;
  legend: string;
  value: SourceDraft;
  onChange: (value: SourceDraft) => void;
}

export function SourceFields({ idPrefix, legend, value, onChange }: SourceFieldsProps) {
  const { t } = useTranslation();
  const id = (name: string) => `${idPrefix}-${name}`;
  return (
    <fieldset className="space-y-3 rounded-lg border bg-card p-4">
      <legend className="px-1 text-sm font-semibold">{legend}</legend>
      <div className="space-y-1.5">
        <Label htmlFor={id("type")}>{t("reconciliation.source.type")}</Label>
        <Select
          id={id("type")}
          value={value.type}
          onChange={(event) => onChange(emptyDraft(event.target.value as SourceDraft["type"]))}
        >
          <option value="file">{t("reconciliation.source.file")}</option>
          <option value="invoices">{t("reconciliation.source.invoices")}</option>
          <option value="bank">{t("reconciliation.source.bank")}</option>
        </Select>
      </div>
      {value.type === "file" ? (
        <>
          <FilePicker
            id={id("file")}
            label={t("reconciliation.source.pick")}
            value={value.fileId}
            onChange={(fileId) => onChange({ ...value, fileId })}
            extensions={["xlsx", "xls", "csv"]}
          />
          {(
            [
              ["keyColumn", "reconciliation.source.keyColumn"],
              ["amountColumn", "reconciliation.source.amountColumn"],
              ["dateColumn", "reconciliation.source.dateColumn"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-1.5">
              <Label htmlFor={id(name)}>{t(label)}</Label>
              <Input
                id={id(name)}
                value={value[name]}
                onChange={(event) => onChange({ ...value, [name]: event.target.value })}
              />
            </div>
          ))}
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={id("from")}>{t("news.filters.from")}</Label>
            <Input
              id={id("from")}
              type="date"
              value={value.from}
              onChange={(event) => onChange({ ...value, from: event.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={id("to")}>{t("news.filters.to")}</Label>
            <Input
              id={id("to")}
              type="date"
              value={value.to}
              onChange={(event) => onChange({ ...value, to: event.target.value })}
            />
          </div>
          {value.type === "invoices" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor={id("direction")}>{t("invoices.fields.direction")}</Label>
              <Select
                id={id("direction")}
                value={value.direction}
                onChange={(event) => onChange({ ...value, direction: event.target.value as typeof value.direction })}
              >
                <option value="">{t("common.all")}</option>
                <option value="sales">{t("invoices.direction.sales")}</option>
                <option value="purchase">{t("invoices.direction.purchase")}</option>
              </Select>
            </div>
          ) : null}
        </div>
      )}
    </fieldset>
  );
}
