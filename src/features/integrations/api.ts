import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { polling } from "@/shared/api/polling";

export type ImportPreview = Json<"/imports/preview", "post">;
export type ImportDetail = Json<"/imports/{id}">;
export type ImportSource = Body<"/imports/preview">["source"];
export type OneCExport = Json<"/journal/export-1c", "post">;

export const IMPORT_SOURCES: ImportSource[] = ["1c", "etaxes", "bank"];

export const importKeys = { detail: (id: string) => ["imports", id] as const };

/** Reads the file and reports what would be imported. Nothing is written. */
export function usePreviewImport() {
  return useMutation({
    mutationFn: async (body: Body<"/imports/preview">) => unwrap(await api.POST("/imports/preview", { body })),
    onError: () => {
      toast.error(i18n.t("integrations.previewFailed"));
    },
  });
}

/** Importing writes records, so the backend asks for approval from somebody else first. */
export function useCommitImport() {
  return useMutation({
    mutationFn: async (importId: string) =>
      unwrap(await api.POST("/imports/{id}/commit", { params: { path: { id: importId } } })),
    onSuccess: () => {
      toast.success(i18n.t("integrations.sentForApproval"));
    },
    onError: () => {
      toast.error(i18n.t("integrations.commitFailed"));
    },
  });
}

export function useImport(id: string) {
  return useQuery({
    queryKey: importKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/imports/{id}", { signal, params: { path: { id } } })),
    retry: false,
    // After approval the import runs in the background.
    refetchInterval: (query) => (query.state.data?.status === "importing" ? polling.intervalMs : false),
  });
}

export function useExportToOneC() {
  return useMutation({
    mutationFn: async (range: { from: string; to: string }) =>
      unwrap(await api.POST("/journal/export-1c", { body: range })),
    onError: () => {
      toast.error(i18n.t("integrations.exportFailed"));
    },
  });
}

export interface SampleRow {
  kind: "invoice" | "bank";
  columns: string[];
}

/** One sample row from the preview, reduced to the few values worth showing. Anything unexpected is skipped. */
export function readSample(value: unknown): SampleRow | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  const data = typeof row.data === "object" && row.data !== null ? (row.data as Record<string, unknown>) : row;
  const text = (x: unknown) => (typeof x === "string" || typeof x === "number" ? String(x) : "");
  if (data.kind === "invoice") {
    return {
      kind: "invoice",
      columns: [text(data.number), text(data.issueDate), text(data.counterpartyName), text(data.gross)],
    };
  }
  if (data.kind === "bank") {
    return {
      kind: "bank",
      columns: [text(data.date), text(data.amount), text(data.description), text(data.reference)],
    };
  }
  return null;
}
