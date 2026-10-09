import { z } from "zod";
import type { components } from "@/api/schema";

export const FILE_STATUSES = [
  "pending",
  "extracting",
  "ready",
  "failed",
] as const satisfies readonly components["schemas"]["FileStatus"][];
export const ARCHIVE_FILTERS = ["active", "archived", "all"] as const;

export const filesSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  status: z.enum(FILE_STATUSES).optional().catch(undefined),
  archived: z.enum(ARCHIVE_FILTERS).optional().catch(undefined),
});

export type FilesSearch = z.infer<typeof filesSearchSchema>;

export function hasActiveFileFilters(search: FilesSearch): boolean {
  return Boolean(search.q?.trim() || search.status || (search.archived && search.archived !== "active"));
}

/** A file in one of these states will change on its own, so the screen keeps polling. */
export function isInProgress(status: components["schemas"]["FileStatus"]): boolean {
  return status === "pending" || status === "extracting";
}
