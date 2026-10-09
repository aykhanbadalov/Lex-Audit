import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { uploadFile } from "@/api/upload";
import { fileKeys, useFileList, type FileRecord } from "@/features/files/api";
import { FileStatusBadge } from "@/features/files/components/FileStatusBadge";
import { FileTypeIcon } from "@/shared/upload/FileTypeIcon";
import { UploadDropzone } from "@/shared/upload/UploadDropzone";
import {
  ARCHIVE_FILTERS,
  FILE_STATUSES,
  filesSearchSchema,
  hasActiveFileFilters,
  type FilesSearch,
} from "@/features/files/filters";
import { DataTable } from "@/shared/components/DataTable";
import { PageHeader } from "@/shared/components/PageHeader";
import { RequirePermission } from "@/shared/components/RequirePermission";
import { usePermission } from "@/shared/hooks/usePermission";
import { useSearchText } from "@/shared/hooks/useSearchText";
import { formatBytes } from "@/shared/lib/bytes";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select } from "@/shared/ui/select";

export const Route = createFileRoute("/_app/files/")({
  validateSearch: filesSearchSchema,
  component: FilesPage,
});

function FilesPage() {
  // Gate first: the content below calls the API, which must not happen for a screen the user cannot open.
  return (
    <RequirePermission permission="files:read">
      <FilesPageContent />
    </RequirePermission>
  );
}

function FilesPageContent() {
  const { t, i18n } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const canWrite = usePermission("files:write");
  const list = useFileList(search);
  const items = useMemo(() => list.data?.pages.flatMap((page) => page.items) ?? [], [list.data]);
  const tag = localeTag(i18n.language);
  const active = hasActiveFileFilters(search);

  const { text, onTextChange } = useSearchText(search.q, (q) => {
    void navigate({ search: (previous) => ({ ...previous, q }), replace: true });
  });

  function update(patch: Partial<FilesSearch>) {
    void navigate({ search: (previous) => ({ ...previous, ...patch }), replace: true });
  }

  const columns = useMemo<ColumnDef<FileRecord, unknown>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("files.columns.name"),
        cell: ({ row }) => (
          <span className="flex min-w-0 items-center gap-2">
            <FileTypeIcon name={row.original.name} />
            <Link
              to="/files/$id"
              params={{ id: row.original.id }}
              state={{ fromFilesSearch: search }}
              className="truncate font-medium hover:underline"
            >
              {row.original.name}
            </Link>
            {row.original.isArchived ? <Badge tone="neutral">{t("files.archivedBadge")}</Badge> : null}
          </span>
        ),
      },
      { accessorKey: "folder", header: t("files.columns.folder") },
      {
        accessorKey: "sizeBytes",
        header: t("files.columns.size"),
        cell: ({ row }) => <span className="tabular-nums">{formatBytes(row.original.sizeBytes, tag)}</span>,
      },
      {
        accessorKey: "status",
        header: t("files.columns.status"),
        cell: ({ row }) => <FileStatusBadge status={row.original.status} />,
      },
      { accessorKey: "ownerName", header: t("files.columns.owner") },
      {
        accessorKey: "updatedAt",
        header: t("files.columns.updated"),
        cell: ({ row }) => formatDate(row.original.updatedAt, tag),
      },
    ],
    [t, tag, search],
  );

  return (
    <>
      <PageHeader title={t("nav.files")} description={t("modules.files")} />

      {canWrite ? (
        <div className="mb-6">
          <UploadDropzone upload={(file, options) => uploadFile(file, {}, options)} queryKey={fileKeys.all} />
        </div>
      ) : null}

      <form
        role="search"
        className="mb-6 grid gap-3 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="space-y-1.5">
          <Label htmlFor="files-q">{t("news.filters.search")}</Label>
          <Input
            id="files-q"
            type="search"
            value={text}
            placeholder={t("files.searchPlaceholder")}
            onChange={(event) => onTextChange(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="files-status">{t("files.columns.status")}</Label>
          <Select
            id="files-status"
            value={search.status ?? ""}
            onChange={(event) => update({ status: (event.target.value || undefined) as FilesSearch["status"] })}
          >
            <option value="">{t("common.all")}</option>
            {FILE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`files.status.${status}`)}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="files-archived">{t("files.archiveFilter.label")}</Label>
          <Select
            id="files-archived"
            value={search.archived ?? "active"}
            onChange={(event) => update({ archived: event.target.value as FilesSearch["archived"] })}
          >
            {ARCHIVE_FILTERS.map((value) => (
              <option key={value} value={value}>
                {t(`files.archiveFilter.${value}`)}
              </option>
            ))}
          </Select>
        </div>
        {active ? (
          <Button type="button" variant="ghost" onClick={() => void navigate({ search: {}, replace: true })}>
            {t("news.filters.reset")}
          </Button>
        ) : null}
      </form>

      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={list.isPending}
        error={list.error}
        onRetry={() => void list.refetch()}
        isFiltered={active}
        emptyTitle={t("files.empty")}
        emptyDescription={canWrite ? t("files.emptyHintWrite") : t("files.emptyHint")}
        onRowClick={(row) =>
          void navigate({ to: "/files/$id", params: { id: row.id }, state: { fromFilesSearch: search } })
        }
      />

      {list.hasNextPage ? (
        <div className="flex justify-center pt-4">
          <Button variant="outline" onClick={() => void list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage ? t("app.loading") : t("common.loadMore")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
