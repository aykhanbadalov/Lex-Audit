import type { components } from "./schema";
import { ApiError, toApiError } from "./errors";
import { API_BASE_URL, refreshSession } from "./session";
import { useAuthStore } from "@/shared/stores/authStore";

export type FileRecord = components["schemas"]["File"];
export type InvoiceUploadResult = components["schemas"]["InvoiceUploadResult"];

export type UploadFields = Record<string, string | string[] | undefined>;

export interface UploadOptions {
  signal?: AbortSignal;
  /** 0..1, fired as bytes leave the browser. */
  onProgress?: (fraction: number) => void;
}

function send<T>(
  path: string,
  file: File,
  fields: UploadFields,
  idempotencyKey: string,
  options: UploadOptions,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}${path}`);
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
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
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
    for (const [name, value] of Object.entries(fields)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) form.append(name, item);
    }
    xhr.send(form);
  });
}

/**
 * Uploads one file as multipart/form-data. An expired access token (401) is refreshed once and the upload is sent
 * again with the same Idempotency-Key, so the server can never store the file twice.
 */
export async function uploadMultipart<T>(
  path: string,
  file: File,
  fields: UploadFields = {},
  options: UploadOptions = {},
): Promise<T> {
  const idempotencyKey = crypto.randomUUID();
  try {
    return await send<T>(path, file, fields, idempotencyKey, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401 && (await refreshSession())) {
      return send<T>(path, file, fields, idempotencyKey, options);
    }
    if (error instanceof ApiError && error.status === 401) useAuthStore.getState().clear();
    throw error;
  }
}

export function uploadFile(
  file: File,
  fields: { folder?: string; tags?: string[] } = {},
  options: UploadOptions = {},
): Promise<FileRecord> {
  return uploadMultipart<FileRecord>("/files", file, fields, options);
}

export function uploadInvoice(file: File, options: UploadOptions = {}): Promise<InvoiceUploadResult> {
  return uploadMultipart<InvoiceUploadResult>("/invoices/upload", file, {}, options);
}
