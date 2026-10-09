import type { components } from "./schema";
import { ApiError, toApiError } from "./errors";
import { API_BASE_URL, refreshSession } from "./session";
import { useAuthStore } from "@/shared/stores/authStore";

export type FileRecord = components["schemas"]["File"];

export interface UploadMeta {
  folder?: string;
  tags?: string[];
}

export interface UploadOptions {
  signal?: AbortSignal;
  /** 0..1, fired as bytes leave the browser. */
  onProgress?: (fraction: number) => void;
}

function send(file: File, meta: UploadMeta, idempotencyKey: string, options: UploadOptions): Promise<FileRecord> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/files`);
    xhr.withCredentials = true;
    xhr.responseType = "text";

    const token = useAuthStore.getState().accessToken;
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Idempotency-Key", idempotencyKey);
    xhr.setRequestHeader("X-Request-Id", crypto.randomUUID());

    // fetch cannot report upload progress, which is why this uses XMLHttpRequest.
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      const body: unknown = (() => {
        try {
          return JSON.parse(xhr.responseText);
        } catch {
          return null;
        }
      })();
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as FileRecord);
      else reject(toApiError(xhr.status, body));
    };
    xhr.onerror = () => reject(new ApiError("NETWORK", "Network error", 0));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));

    options.signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    if (options.signal?.aborted) {
      reject(new DOMException("Upload cancelled", "AbortError"));
      return;
    }

    const form = new FormData();
    form.append("file", file);
    if (meta.folder) form.append("folder", meta.folder);
    meta.tags?.forEach((tag) => form.append("tags", tag));
    xhr.send(form);
  });
}

/**
 * Uploads one file. An expired access token (401) is refreshed once and the upload is sent again with the same
 * Idempotency-Key, so the server can never store the file twice.
 */
export async function uploadFile(file: File, meta: UploadMeta = {}, options: UploadOptions = {}): Promise<FileRecord> {
  const idempotencyKey = crypto.randomUUID();
  try {
    return await send(file, meta, idempotencyKey, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (await refreshSession())) {
      return send(file, meta, idempotencyKey, options);
    }
    if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clear();
    throw error;
  }
}
