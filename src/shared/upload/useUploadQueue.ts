import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/api/errors";
import type { UploadOptions } from "@/api/upload";
import { checkUpload, type UploadRejection } from "./limits";

export type UploadError = UploadRejection | "network" | "forbidden" | "server";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  status: "queued" | "uploading" | "done" | "error";
  /** 0..1 */
  progress: number;
  error?: UploadError;
}

const MAX_PARALLEL = 3;

function toUploadError(error: unknown): UploadError {
  if (error instanceof ApiError) {
    if (error.status === 413) return "tooLarge";
    if (error.status === 415) return "unsupportedType";
    if (error.status === 403) return "forbidden";
    if (error.code === "NETWORK") return "network";
  }
  return "server";
}

/**
 * Uploads files with at most three running at once. Files that break the known limits are shown as failed
 * straight away and never leave the browser. Each upload can be cancelled while it runs.
 */
export function useUploadQueue(
  upload: (file: File, options: UploadOptions) => Promise<unknown>,
  queryKey: readonly unknown[],
) {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<UploadItem[]>([]);
  const files = useRef(new Map<string, File>());
  const controllers = useRef(new Map<string, AbortController>());
  const started = useRef(new Set<string>());

  const patch = useCallback((id: string, changes: Partial<UploadItem>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const addFiles = useCallback((incoming: File[]) => {
    const created = incoming.map((file): UploadItem => {
      const id = crypto.randomUUID();
      const rejection = checkUpload(file);
      if (!rejection) files.current.set(id, file);
      return {
        id,
        name: file.name,
        size: file.size,
        status: rejection ? "error" : "queued",
        progress: 0,
        error: rejection ?? undefined,
      };
    });
    setItems((current) => [...current, ...created]);
  }, []);

  // Start queued uploads whenever there is a free slot.
  useEffect(() => {
    const running = items.filter((item) => item.status === "uploading").length;
    const free = MAX_PARALLEL - running;
    items
      .filter((item) => item.status === "queued" && !started.current.has(item.id))
      .slice(0, Math.max(free, 0))
      .forEach((item) => {
        const file = files.current.get(item.id);
        if (!file) return;
        started.current.add(item.id);
        const controller = new AbortController();
        controllers.current.set(item.id, controller);
        patch(item.id, { status: "uploading" });

        upload(file, { signal: controller.signal, onProgress: (progress) => patch(item.id, { progress }) })
          .then(() => {
            patch(item.id, { status: "done", progress: 1 });
            return queryClient.invalidateQueries({ queryKey });
          })
          .catch((error: unknown) => {
            if (error instanceof DOMException && error.name === "AbortError") return; // removed by the user
            patch(item.id, { status: "error", error: toUploadError(error) });
          })
          .finally(() => {
            files.current.delete(item.id);
            controllers.current.delete(item.id);
          });
      });
  }, [items, patch, queryClient, upload, queryKey]);

  // Leaving the page stops uploads that are still running.
  useEffect(() => {
    const running = controllers.current;
    return () => running.forEach((controller) => controller.abort());
  }, []);

  /** Cancels a running upload and removes the row. */
  const remove = useCallback((id: string) => {
    controllers.current.get(id)?.abort();
    files.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const clearFinished = useCallback(() => {
    setItems((current) => current.filter((item) => item.status === "queued" || item.status === "uploading"));
  }, []);

  return { items, addFiles, remove, clearFinished };
}
