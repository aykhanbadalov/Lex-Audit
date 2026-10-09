import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { components } from "@/api/schema";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import { NEWS_CATEGORIES, READ_FILTERS, RISK_LEVELS, type NewsSearch } from "../filters";

interface NewsFiltersProps {
  search: NewsSearch;
  sources: components["schemas"]["NewsSource"][] | undefined;
  hasActiveFilters: boolean;
  onChange: (patch: Partial<NewsSearch>) => void;
  onReset: () => void;
}

export function NewsFilters({ search, sources, hasActiveFilters, onChange, onReset }: NewsFiltersProps) {
  const { t } = useTranslation();
  const id = useId();

  const { text, onTextChange } = useSearchText(search.q, (q) => onChange({ q }));

  const field = (name: string) => `${id}-${name}`;

  return (
    <form
      role="search"
      aria-label={t("news.filters.label")}
      className="space-y-3"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor={field("q")}>{t("news.filters.search")}</Label>
          <Input
            id={field("q")}
            type="search"
            value={text}
            placeholder={t("news.filters.searchPlaceholder")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("source")}>{t("news.filters.source")}</Label>
          <Select
            id={field("source")}
            value={search.sourceId ?? ""}
            onChange={(event) => onChange({ sourceId: event.target.value || undefined })}
          >
            <option value="">{t("common.all")}</option>
            {sources?.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("category")}>{t("news.filters.category")}</Label>
          <Select
            id={field("category")}
            value={search.category ?? ""}
            onChange={(event) => onChange({ category: (event.target.value || undefined) as NewsSearch["category"] })}
          >
            <option value="">{t("common.all")}</option>
            {NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {t(`category.${category}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("risk")}>{t("news.filters.risk")}</Label>
          <Select
            id={field("risk")}
            value={search.riskLevel ?? ""}
            onChange={(event) => onChange({ riskLevel: (event.target.value || undefined) as NewsSearch["riskLevel"] })}
          >
            <option value="">{t("common.all")}</option>
            {RISK_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`risk.${level}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("read")}>{t("news.filters.readState")}</Label>
          <Select
            id={field("read")}
            value={search.read ?? "all"}
            onChange={(event) => onChange({ read: event.target.value as NewsSearch["read"] })}
          >
            {READ_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`news.filters.read.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("from")}>{t("news.filters.from")}</Label>
          <Input
            id={field("from")}
            type="date"
            value={search.from ?? ""}
            max={search.to}
            onChange={(event) => onChange({ from: event.target.value || undefined })}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={field("to")}>{t("news.filters.to")}</Label>
          <Input
            id={field("to")}
            type="date"
            value={search.to ?? ""}
            min={search.from}
            onChange={(event) => onChange({ to: event.target.value || undefined })}
          />
        </div>
        <div className="flex items-end gap-4">
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4"
              checked={search.bookmarked ?? false}
              onChange={(event) => onChange({ bookmarked: event.target.checked || undefined })}
            />
            {t("news.filters.bookmarked")}
          </label>
        </div>
      </div>
      {hasActiveFilters ? (
        <Button type="button" variant="ghost" size="sm" onClick={onReset}>
          {t("news.filters.reset")}
        </Button>
      ) : null}
    </form>
  );
}
