import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { saveBlob } from "@/shared/lib/download";
import { isInProgress, type FilesSearch } from "./filters";

export type FileRecord = components["schemas"]["File"];
export type FileDetail = components["schemas"]["FileDetail"];
export type FileUpdate = components["schemas"]["FileUpdate"];

export const PAGE_SIZE = 10;

/** How often a screen re-reads files that are still being processed. Tests shorten it. */
export const pollConfig = { intervalMs: 3000 };

export const fileKeys = {
  all: ["files"] as const,
  lists: ["files", "list"] as const,
  list: (filters: FilesSearch) => ["files", "list", filters] as const,
  detail: (id: string) => ["files", "detail", id] as const,
};

export function useFileList(filters: FilesSearch) {
  return useInfiniteQuery({
    queryKey: fileKeys.list(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) =>
      unwrap(
        await api.GET("/files", {
          signal,
          params: {
            query: {
              q: filters.q?.trim() || undefined,
              status: filters.status,
              archived: filters.archived,
              cursor: pageParam,
              limit: PAGE_SIZE,
            },
          },
        }),
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    // Keep polling only while something on screen is still being processed.
    refetchInterval: (query) => {
      const pages = (query.state.data as InfiniteData<components["schemas"]["FilePage"]> | undefined)?.pages ?? [];
      return pages.some((page) => page.items.some((file) => isInProgress(file.status))) ? pollConfig.intervalMs : false;
    },
  });
}

export function useFile(id: string) {
  return useQuery({
    queryKey: fileKeys.detail(id),
    queryFn: async ({ signal }) => unwrap(await api.GET("/files/{id}", { signal, params: { path: { id } } })),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && isInProgress(query.state.data.status) ? pollConfig.intervalMs : false,
  });
}

function useFileAction<TVariables>(action: (variables: TVariables) => Promise<unknown>, successKey: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      toast.success(i18n.t(successKey));
      return queryClient.invalidateQueries({ queryKey: fileKeys.all });
    },
    onError: () => {
      toast.error(i18n.t("files.actionFailed"));
    },
  });
}

export function useUpdateFile(id: string) {
  return useFileAction(
    async (body: FileUpdate) => unwrap(await api.PATCH("/files/{id}", { params: { path: { id } }, body })),
    "files.saved",
  );
}

export function useArchiveFile(id: string) {
  return useFileAction(
    async () => unwrap(await api.POST("/files/{id}/archive", { params: { path: { id } } })),
    "files.archived",
  );
}

export function useRestoreFile(id: string) {
  return useFileAction(
    async () => unwrap(await api.POST("/files/{id}/restore", { params: { path: { id } } })),
    "files.restored",
  );
}

export function useReindexFile(id: string) {
  return useFileAction(
    async () => unwrap(await api.POST("/files/{id}/reindex", { params: { path: { id } } })),
    "files.reindexStarted",
  );
}

/** An <a href> cannot send the bearer token, so the bytes are fetched with the API client and saved from memory. */
export async function downloadFile(file: Pick<FileRecord, "id" | "name">): Promise<void> {
  const { data } = await api.GET("/files/{id}/content", { params: { path: { id: file.id } }, parseAs: "blob" });
  if (!data) throw new Error("Empty download");
  saveBlob(data, file.name);
}
