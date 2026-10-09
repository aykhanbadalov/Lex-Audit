import { createFileRoute, Link, useLocation } from "@tanstack/react-router";
import { Archive, ArchiveRestore, ArrowLeft, Download, FileQuestion, Pencil, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ApiError } from "@/api/errors";
import {
  downloadFile,
  useArchiveFile,
  useFile,
  useReindexFile,
  useRestoreFile,
  type FileDetail,
} from "@/features/files/api";
import { FileEditDialog } from "@/features/files/components/FileEditDialog";
import { FileStatusBadge } from "@/features/files/components/FileStatusBadge";
import { FileTypeIcon } from "@/shared/upload/FileTypeIcon";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { EmptyState } from "@/shared/components/EmptyState";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatBytes } from "@/shared/lib/bytes";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";

export const Route = createFileRoute("/_app/files/$id")({
  component: FileDetailPage,
});

function FileDetailPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="files:read">
      <FileDetailContent />
    </RequirePermission>
  );
}

function BackLink() {
  const { t } = useTranslation();
  // Return to the list as the user left it; a direct visit has no list state, so no filters are applied.
  const listSearch = useLocation({ select: (location) => location.state.fromFilesSearch });
  return (
    <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
      <Link to="/files" search={listSearch ?? {}}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {t("files.back")}
      </Link>
    </Button>
  );
}

function FileDetailContent() {
  const { t, i18n } = useTranslation();
  const { id } = Route.useParams();
  const file = useFile(id);
  const tag = localeTag(i18n.language);

  if (file.isPending) {
    return (
      <>
        <BackLink />
        <LoadingState />
      </>
    );
  }
  if (file.isError) {
    return (
      <>
        <BackLink />
        {file.error instanceof ApiError && file.error.code === "NOT_FOUND" ? (
          <EmptyState icon={FileQuestion} title={t("files.notFound")} description={t("files.notFoundHint")} />
        ) : (
          <ErrorState message={file.error.message} onRetry={() => void file.refetch()} />
        )}
      </>
    );
  }
  return (
    <>
      <BackLink />
      <FileView file={file.data} locale={tag} />
    </>
  );
}

function FileView({ file, locale }: { file: FileDetail; locale: string }) {
  const { t } = useTranslation();
  const canWrite = usePermission("files:write");
  const [editing, setEditing] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const archive = useArchiveFile(file.id);
  const restore = useRestoreFile(file.id);
  const reindex = useReindexFile(file.id);

  async function download() {
    setDownloading(true);
    try {
      await downloadFile(file);
    } catch {
      toast.error(t("files.downloadFailed"));
    } finally {
      setDownloading(false);
    }
  }

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <FileStatusBadge status={file.status} />
          {file.isArchived ? <Badge tone="neutral">{t("files.archivedBadge")}</Badge> : null}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="flex min-w-0 items-center gap-2 text-2xl font-semibold tracking-tight break-all">
            <FileTypeIcon name={file.name} className="size-6 shrink-0" />
            {file.name}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void download()} disabled={downloading}>
              <Download className="size-4" aria-hidden="true" />
              {t("files.download")}
            </Button>
            {canWrite ? (
              <>
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="size-4" aria-hidden="true" />
                  {t("files.edit.open")}
                </Button>
                {file.isArchived ? (
                  <Button variant="outline" size="sm" onClick={() => restore.mutate()} disabled={restore.isPending}>
                    <ArchiveRestore className="size-4" aria-hidden="true" />
                    {t("files.restore")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmingArchive(true)}>
                    <Archive className="size-4" aria-hidden="true" />
                    {t("files.archive")}
                  </Button>
                )}
              </>
            ) : null}
          </div>
        </div>
      </header>

      {file.status === "failed" ? (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/50 p-4 text-sm"
        >
          <div>
            <p className="font-medium">{t("files.failedTitle")}</p>
            {file.statusDetail ? <p className="text-muted-foreground">{file.statusDetail}</p> : null}
          </div>
          {canWrite ? (
            <Button size="sm" onClick={() => reindex.mutate()} disabled={reindex.isPending}>
              <RefreshCw className="size-4" aria-hidden="true" />
              {t("files.reindex")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <Info label={t("files.columns.folder")} value={file.folder} />
        <Info label={t("files.columns.size")} value={formatBytes(file.sizeBytes, locale)} />
        <Info label={t("files.type")} value={file.mimeType} />
        <Info label={t("files.columns.owner")} value={file.ownerName} />
        <Info label={t("files.created")} value={formatDateTime(file.createdAt, locale)} />
        <Info label={t("files.columns.updated")} value={formatDateTime(file.updatedAt, locale)} />
        <div className="sm:col-span-2 lg:col-span-3">
          <dt className="text-muted-foreground">{t("files.tags")}</dt>
          <dd className="mt-1 flex flex-wrap gap-1.5">
            {file.tags.length === 0 ? (
              <span className="text-muted-foreground">{t("files.noTags")}</span>
            ) : (
              file.tags.map((name) => <Badge key={name}>{name}</Badge>)
            )}
          </dd>
        </div>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>{t("files.extractedText")}</CardTitle>
        </CardHeader>
        <CardContent>
          {file.extractedTextPreview ? (
            // Plain text on purpose: extracted content is never rendered as HTML.
            <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">{file.extractedTextPreview}</pre>
          ) : (
            <p className="text-sm text-muted-foreground">
              {file.status === "failed"
                ? t("files.noTextFailed")
                : file.status === "ready"
                  ? t("files.noText")
                  : t("files.textPending")}
            </p>
          )}
        </CardContent>
      </Card>

      <section aria-labelledby="versions-heading" className="space-y-2">
        <h2 id="versions-heading" className="text-lg font-semibold">
          {t("files.versions")}
        </h2>
        <ul className="space-y-2">
          {file.versions.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3 text-sm"
            >
              <span className="font-medium">
                v{version.versionNo}
                {version.versionNo === file.currentVersionNo ? ` · ${t("files.currentVersion")}` : ""}
              </span>
              <span className="text-muted-foreground">
                {formatBytes(version.sizeBytes, locale)} · {version.uploadedByName} ·{" "}
                {formatDateTime(version.uploadedAt, locale)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="usage-heading" className="space-y-2">
        <h2 id="usage-heading" className="text-lg font-semibold">
          {t("files.usage")}
        </h2>
        {file.usage.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("files.noUsage")}</p>
        ) : (
          <ul className="space-y-2">
            {file.usage.map((entry) => (
              <li key={entry.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t(`files.usageAction.${entry.action}`)}</span>
                  <span className="text-muted-foreground">
                    {entry.actorName} · {formatDateTime(entry.occurredAt, locale)}
                  </span>
                </div>
                <p className="mt-1 text-muted-foreground">{entry.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {editing ? <FileEditDialog file={file} open onOpenChange={setEditing} /> : null}
      <ConfirmDialog
        open={confirmingArchive}
        onOpenChange={setConfirmingArchive}
        title={t("files.archiveConfirm.title")}
        description={t("files.archiveConfirm.description")}
        confirmLabel={t("files.archive")}
        busy={archive.isPending}
        onConfirm={() => archive.mutate(undefined, { onSettled: () => setConfirmingArchive(false) })}
      />
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-all">{value}</dd>
    </div>
  );
}
