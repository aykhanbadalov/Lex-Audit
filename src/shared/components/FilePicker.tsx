import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { api } from "@/api/client";
import { unwrap } from "@/api/unwrap";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

interface FilePickerProps {
  id: string;
  label: string;
  value: string;
  onChange: (fileId: string) => void;
  /** Lower-case extensions without the dot, for example ["xlsx", "csv"]. Everything is offered when omitted. */
  extensions?: readonly string[];
}

/** Chooses one of the company's stored files. Archived files are not offered. */
export function FilePicker({ id, label, value, onChange, extensions }: FilePickerProps) {
  const { t } = useTranslation();
  const files = useQuery({
    queryKey: ["files", "picker"],
    queryFn: async ({ signal }) => unwrap(await api.GET("/files", { signal, params: { query: { limit: 100 } } })),
    staleTime: 30_000,
  });
  const offered = (files.data?.items ?? []).filter(
    (file) => !extensions || extensions.includes(file.name.split(".").pop()?.toLowerCase() ?? ""),
  );
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} disabled={files.isPending}>
        <option value="">{files.isPending ? t("app.loading") : t("filePicker.choose")}</option>
        {offered.map((file) => (
          <option key={file.id} value={file.id}>
            {file.name} ({file.folder})
          </option>
        ))}
      </Select>
      {files.isSuccess && offered.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("filePicker.none")}</p>
      ) : null}
    </div>
  );
}
