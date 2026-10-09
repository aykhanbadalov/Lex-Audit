import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ArrowDown, ArrowUp, ArrowUpDown, SearchX } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/shared/lib/cn";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { LoadingState } from "./LoadingState";

interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowId: (row: TData) => string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  /** Shown instead of the table when there is no data and no filter is active. */
  emptyTitle: string;
  emptyDescription?: string;
  /** True when filters/search are applied, so an empty result reads as "no results" rather than "no data". */
  isFiltered?: boolean;
  onRowClick?: (row: TData) => void;
  /** Height of the scroll area. The body is virtualized, so large lists stay fast. */
  height?: number;
}

const ROW_HEIGHT = 44;

/**
 * Virtualizing hides rows from browser find-in-page and adds complexity, so it is only worth it for long lists.
 * Below this size every row is rendered.
 */
export const VIRTUALIZE_AFTER_ROWS = 100;

export function DataTable<TData>({
  columns,
  data,
  getRowId,
  isLoading,
  error,
  onRetry,
  emptyTitle,
  emptyDescription,
  isFiltered,
  onRowClick,
  height = 480,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // TanStack Table returns unmemoizable functions; this only matters with React Compiler, which this project does not use.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data,
    columns,
    getRowId,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const rows = table.getRowModel().rows;
  const virtualize = rows.length > VIRTUALIZE_AFTER_ROWS;
  const virtualizer = useVirtualizer({
    count: virtualize ? rows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (rows.length === 0) {
    return isFiltered ? (
      <EmptyState icon={SearchX} title={t("table.noResults")} description={t("table.noResultsHint")} />
    ) : (
      <EmptyState title={emptyTitle} description={emptyDescription} />
    );
  }

  const virtualRows = virtualize ? virtualizer.getVirtualItems() : [];
  const visibleRows = virtualize ? virtualRows.flatMap((item) => rows[item.index] ?? []) : rows;
  const paddingTop = virtualRows.length > 0 ? (virtualRows[0]?.start ?? 0) : 0;
  const paddingBottom =
    virtualRows.length > 0 ? virtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end ?? 0) : 0;

  return (
    <div ref={scrollRef} className="overflow-auto rounded-lg border" style={{ maxHeight: height }}>
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-muted">
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                const canSort = header.column.getCanSort();
                return (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"}
                    className="px-3 py-2 text-left font-medium"
                  >
                    {header.isPlaceholder ? null : canSort ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-ring"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === "asc" ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : sorted === "desc" ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                        )}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {paddingTop > 0 ? (
            <tr aria-hidden="true">
              <td style={{ height: paddingTop }} />
            </tr>
          ) : null}
          {visibleRows.map((row) => {
            return (
              <tr
                key={row.id}
                style={{ height: ROW_HEIGHT }}
                className={cn("border-t", onRowClick && "cursor-pointer hover:bg-accent")}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                onKeyDown={
                  onRowClick
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          onRowClick(row.original);
                        }
                      }
                    : undefined
                }
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            );
          })}
          {paddingBottom > 0 ? (
            <tr aria-hidden="true">
              <td style={{ height: paddingBottom }} />
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}
