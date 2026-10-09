import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { polling } from "@/shared/api/polling";

export type ExcelJob = Json<"/excel/jobs/{id}">;
export type ExcelJobRequest = Body<"/excel/jobs">;

export const excelKeys = { job: (id: string) => ["excel", "job", id] as const };

const working = (job: ExcelJob) => job.status === "pending" || job.status === "running";

export function useStartExcelJob() {
  return useMutation({
    mutationFn: async (body: ExcelJobRequest) => unwrap(await api.POST("/excel/jobs", { body })),
    onError: () => {
      toast.error(i18n.t("excel.failed"));
    },
  });
}

/** A job runs in the background; the screen keeps asking until it is done or has failed. */
export function useExcelJob(id: string) {
  return useQuery({
    queryKey: excelKeys.job(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/excel/jobs/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) => (query.state.data && working(query.state.data) ? polling.intervalMs : false),
  });
}

export interface ColumnProfile {
  name: string;
  type: "number" | "date" | "text" | "empty";
  nonEmpty: number;
  distinct: number;
  sum?: string;
  min?: string;
  max?: string;
  samples: string[];
  unparsable: number;
}

export interface TableProfile {
  rows: number;
  emptyRows: number;
  duplicateRows: number;
  truncated: boolean;
  columns: ColumnProfile[];
}

export interface CleanResult {
  rowsIn: number;
  rowsOut: number;
  log: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

/** The result of a job is free-form JSON on the wire. Each reader checks the shape it expects and returns null if not. */
export function readProfile(result: unknown): TableProfile | null {
  if (!isRecord(result) || !Array.isArray(result.columns) || typeof result.rows !== "number") return null;
  return {
    rows: result.rows,
    emptyRows: typeof result.emptyRows === "number" ? result.emptyRows : 0,
    duplicateRows: typeof result.duplicateRows === "number" ? result.duplicateRows : 0,
    truncated: result.truncated === true,
    columns: result.columns.flatMap((column): ColumnProfile[] =>
      isRecord(column) && typeof column.name === "string"
        ? [
            {
              name: column.name,
              type: (["number", "date", "text", "empty"] as const).find((type) => type === column.type) ?? "text",
              nonEmpty: Number(column.nonEmpty ?? 0),
              distinct: Number(column.distinct ?? 0),
              sum: typeof column.sum === "string" ? column.sum : undefined,
              min: typeof column.min === "string" ? column.min : undefined,
              max: typeof column.max === "string" ? column.max : undefined,
              samples: Array.isArray(column.samples) ? column.samples.map(String) : [],
              unparsable: Number(column.unparsable ?? 0),
            },
          ]
        : [],
    ),
  };
}

export function readClean(result: unknown): CleanResult | null {
  if (!isRecord(result) || typeof result.rowsIn !== "number" || typeof result.rowsOut !== "number") return null;
  return {
    rowsIn: result.rowsIn,
    rowsOut: result.rowsOut,
    log: Array.isArray(result.log) ? result.log.map(String) : [],
  };
}
