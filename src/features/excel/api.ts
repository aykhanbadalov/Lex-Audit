import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { polling } from "@/shared/api/polling";

export type Workbook = components["schemas"]["Workbook"];
export type WorkbookDetail = components["schemas"]["WorkbookDetail"];
export type ExcelJob = components["schemas"]["ExcelJob"];
export type ExcelJobRequest = components["schemas"]["ExcelJobRequest"];
export type ExcelOperation = components["schemas"]["ExcelOperation"];
export type ColumnProfile = components["schemas"]["ColumnProfile"];

export const EXCEL_OPERATIONS = [
  "trim_spaces",
  "remove_duplicates",
  "normalize_dates",
] as const satisfies readonly ExcelOperation[];

export const excelKeys = {
  all: ["excel"] as const,
  list: ["excel", "list"] as const,
  detail: (id: string) => ["excel", "detail", id] as const,
};

const busy = (workbook: Pick<Workbook, "status">) => workbook.status === "uploaded" || workbook.status === "profiling";
const working = (job: ExcelJob) => job.status === "queued" || job.status === "running";

export function useWorkbooks() {
  return useQuery({
    queryKey: excelKeys.list,
    queryFn: async ({ signal }) => unwrap(await api.GET("/excel/workbooks", { signal })),
    refetchInterval: (query) => (query.state.data?.some(busy) ? polling.intervalMs : false),
  });
}

export function useWorkbook(id: string) {
  return useQuery({
    queryKey: excelKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/excel/workbooks/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && (busy(query.state.data) || query.state.data.jobs.some(working)) ? polling.intervalMs : false,
  });
}

export function useCreateExcelJob(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: ExcelJobRequest) =>
      unwrap(await api.POST("/excel/workbooks/{id}/jobs", { params: { path: { id } }, body })),
    onSuccess: () => {
      toast.success(i18n.t("excel.job.started"));
      return queryClient.invalidateQueries({ queryKey: excelKeys.detail(id) });
    },
    onError: () => {
      toast.error(i18n.t("excel.job.failed"));
    },
  });
}

/** What an operation needs before it may run. The server checks again; this only avoids a pointless round trip. */
export function operationProblem(
  operation: ExcelOperation,
  columns: readonly string[],
): "needColumn" | "needOneColumn" | null {
  if (operation === "remove_duplicates" && columns.length < 1) return "needColumn";
  if (operation === "normalize_dates" && columns.length !== 1) return "needOneColumn";
  return null;
}
