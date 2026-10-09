import { CheckCircle2, CircleAlert, UploadCloud, X } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { formatBytes } from "@/shared/lib/bytes";
import { localeTag } from "@/shared/lib/locale";
import { Button } from "@/shared/ui/button";
import { MAX_UPLOAD_BYTES } from "../limits";
import { useUploadQueue, type UploadItem } from "../useUploadQueue";
import { FileTypeIcon } from "./FileTypeIcon";

export function UploadDropzone() {
  const { t, i18n } = useTranslation();
  const tag = localeTag(i18n.language);
  const { items, addFiles, remove, clearFinished } = useUploadQueue();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    addFiles([...event.dataTransfer.files]);
  }

  const finished = items.some((item) => item.status === "done" || item.status === "error");

  return (
    <section aria-label={t("files.upload.title")} className="space-y-3">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border",
        )}
      >
        <UploadCloud className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm font-medium">{t("files.upload.drop")}</p>
        <p className="text-xs text-muted-foreground">
          {t("files.upload.hint", { size: formatBytes(MAX_UPLOAD_BYTES, tag) })}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          {t("files.upload.choose")}
        </Button>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="sr-only"
          aria-label={t("files.upload.input")}
          onChange={(event) => {
            addFiles([...(event.target.files ?? [])]);
            event.target.value = ""; // lets the same file be chosen again
          }}
        />
      </div>

      {items.length > 0 ? (
        <div className="space-y-2">
          <ul className="space-y-2" aria-label={t("files.upload.queue")}>
            {items.map((item) => (
              <UploadRow key={item.id} item={item} onRemove={() => remove(item.id)} locale={tag} />
            ))}
          </ul>
          {finished ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearFinished}>
              {t("files.upload.clear")}
            </Button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function UploadRow({ item, onRemove, locale }: { item: UploadItem; onRemove: () => void; locale: string }) {
  const { t } = useTranslation();
  const percent = Math.round(item.progress * 100);
  return (
    <li className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
      <FileTypeIcon name={item.name} />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-medium">{item.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(item.size, locale)}</span>
        </div>
        {item.status === "uploading" || item.status === "queued" ? (
          <div className="space-y-1">
            <div
              role="progressbar"
              aria-label={item.name}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div className="h-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">
              {item.status === "queued" ? t("files.upload.queued") : t("files.upload.uploading", { percent })}
            </p>
          </div>
        ) : item.status === "done" ? (
          <p className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="size-3.5" aria-hidden="true" />
            {t("files.upload.done")}
          </p>
        ) : (
          <p role="alert" className="flex items-center gap-1 text-xs text-destructive">
            <CircleAlert className="size-3.5" aria-hidden="true" />
            {t(`files.upload.error.${item.error ?? "server"}`)}
          </p>
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label={t(item.status === "uploading" ? "files.upload.cancel" : "files.upload.remove", { name: item.name })}
        onClick={onRemove}
      >
        <X className="size-4" aria-hidden="true" />
      </Button>
    </li>
  );
}
