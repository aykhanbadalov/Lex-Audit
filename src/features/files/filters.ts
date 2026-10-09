import { z } from "zod";

export const ARCHIVE_FILTERS = ["active", "all"] as const;

export const filesSearchSchema = z.object({
  q: z.coerce.string().optional().catch(undefined),
  archived: z.enum(ARCHIVE_FILTERS).optional().catch(undefined),
});

export type FilesSearch = z.infer<typeof filesSearchSchema>;

export type FileStatus = "pending" | "extracting" | "ready" | "failed";

export function hasActiveFileFilters(search: FilesSearch): boolean {
  return Boolean(search.q?.trim() || (search.archived && search.archived !== "active"));
}

/** A file in one of these states will change on its own, so the screen keeps polling. */
export function isInProgress(status: FileStatus | null): boolean {
  return status === null || status === "pending" || status === "extracting";
}
