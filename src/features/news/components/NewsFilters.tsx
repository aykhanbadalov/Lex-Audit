import { useId } from "react";
import { useTranslation } from "react-i18next";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";
import type { NewsSource } from "../api";
import { READ_FILTERS, type NewsSearch } from "../filters";

interface NewsFiltersProps {
  search: NewsSearch;
  sources: NewsSource[] | undefined;
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
