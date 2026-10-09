import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { polling } from "@/shared/api/polling";

export type ImportJob = components["schemas"]["ImportJob"];
export type ImportDetail = components["schemas"]["ImportDetail"];
export type ImportSource = components["schemas"]["ImportSource"];
export type Mapping = Record<string, string | null>;

export const IMPORT_SOURCES = ["onec", "etaxes", "bank"] as const satisfies readonly ImportSource[];

export const importKeys = {
  all: ["imports"] as const,
  list: ["imports", "list"] as const,
  detail: (id: string) => ["imports", "detail", id] as const,
};

const busy = (status: ImportJob["status"]) => status === "analysing" || status === "importing";

export function useImports() {
  return useQuery({
    queryKey: importKeys.list,
    queryFn: async ({ signal }) => unwrap(await api.GET("/imports", { signal })),
    refetchInterval: (query) => (query.state.data?.some((job) => busy(job.status)) ? polling.intervalMs : false),
  });
}

export function useImport(id: string) {
  return useQuery({
    queryKey: importKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/imports/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) => (query.state.data && busy(query.state.data.status) ? polling.intervalMs : false),
  });
}

export function useSaveMapping(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (mapping: Mapping) =>
      unwrap(await api.PUT("/imports/{id}/mapping", { params: { path: { id } }, body: { mapping } })),
    onSuccess: (detail) => {
      queryClient.setQueryData(importKeys.detail(id), detail);
      toast.success(i18n.t("integrations.mappingSaved"));
    },
    onError: () => {
      toast.error(i18n.t("integrations.mappingFailed"));
    },
  });
}

export function useCommitImport(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/imports/{id}/commit", { params: { path: { id } } })),
    onSuccess: (detail) => {
      queryClient.setQueryData(importKeys.detail(id), detail);
      void queryClient.invalidateQueries({ queryKey: importKeys.list });
    },
    onError: () => {
      toast.error(i18n.t("integrations.commitFailed"));
    },
  });
}

export function useExportToOneC() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (periodId: string) => unwrap(await api.POST("/exports/onec", { body: { periodId } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files"] }),
    onError: () => {
      toast.error(i18n.t("integrations.export.failed"));
    },
  });
}

/** Same column twice would feed two fields from one source column; the server refuses it, the UI just does not offer it. */
export function availableColumns(columns: readonly string[], mapping: Mapping, field: string): string[] {
  const usedElsewhere = new Set(
    Object.entries(mapping).flatMap(([key, column]) => (key !== field && column ? [column] : [])),
  );
  return columns.filter((column) => !usedElsewhere.has(column));
}

export function mappingsEqual(a: Mapping, b: Mapping): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys].every((key) => (a[key] ?? null) === (b[key] ?? null));
}
