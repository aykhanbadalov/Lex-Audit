import { delay, http, HttpResponse } from "msw";
import { ALLOWED_EXTENSIONS, extensionOf, MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import { addUploadedFile, allFiles, findFile, restartProcessing, toDetail, toRecord, touch } from "../fixtures/files";
import { apiError, authorize } from "./auth";
import { parseMultipart } from "../multipart";
import { apiPath } from "./base";

const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(200));

function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("az").includes(needle.toLocaleLowerCase("az"));
}

/** Uploads already stored under an Idempotency-Key are returned as they were, not created twice. */
const uploadsByKey = new Map<string, string>();
export function resetUploadKeys(): void {
  uploadsByKey.clear();
}

export const filesHandlers = [
  http.get(apiPath("/files"), async ({ request }) => {
    const auth = authorize(request, "files:read");
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim();
    const status = params.get("status");
    const tag = params.get("tag");
    const archived = params.get("archived") ?? "active";
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allFiles()
      .filter(
        (file) =>
          (!q || matches(`${file.name} ${file.tags.join(" ")} ${file.folder}`, q)) &&
          (!status || file.status === status) &&
          (!tag || file.tags.includes(tag)) &&
          (archived === "all" || (archived === "archived" ? file.isArchived : !file.isArchived)),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const next = offset + limit;
    return HttpResponse.json({
      items: filtered.slice(offset, next).map(toRecord),
      nextCursor: next < filtered.length ? String(next) : null,
    });
  }),

  http.post(apiPath("/files"), async ({ request }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    await latency();

    const key = request.headers.get("Idempotency-Key");
    if (!key) return apiError(422, "VALIDATION_FAILED", "Idempotency-Key header is required");
    const existing = uploadsByKey.get(key);
    if (existing) {
      const found = findFile(existing);
      if (found) return HttpResponse.json(toRecord(found), { status: 201 });
    }

    const form = await parseMultipart(request);
    const upload = form?.file;
    if (!form || !upload) return apiError(422, "VALIDATION_FAILED", "A file is required");

    // The server is the authority on limits; the frontend only checks first to be quicker.
    if (upload.size > MAX_UPLOAD_BYTES) return apiError(413, "VALIDATION_FAILED", "File is too large");
    if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(upload.name))) {
      return apiError(415, "VALIDATION_FAILED", "File type is not allowed");
    }

    const created = addUploadedFile({
      name: upload.name,
      mimeType: upload.type,
      sizeBytes: upload.size,
      folder: form.fields.get("folder")?.[0] || "/",
      tags: form.fields.get("tags") ?? [],
    });
    uploadsByKey.set(key, created.id);
    return HttpResponse.json(toRecord(created), { status: 201 });
  }),

  http.get(apiPath("/files/:id/content"), async ({ request, params }) => {
    const auth = authorize(request, "files:read");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    return new HttpResponse(found.content, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(found.name)}`,
      },
    });
  }),

  http.get(apiPath("/files/:id"), async ({ request, params }) => {
    const auth = authorize(request, "files:read");
    if ("response" in auth) return auth.response;
    await latency();
    const found = findFile(String(params.id));
    return found ? HttpResponse.json(toDetail(found)) : apiError(404, "NOT_FOUND", "File not found");
  }),

  http.patch(apiPath("/files/:id"), async ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");

    const body = (await request.json()) as { name?: string; folder?: string; tags?: string[] };
    if (body.name !== undefined && (body.name.trim() === "" || body.name.includes("/"))) {
      return apiError(422, "VALIDATION_FAILED", "Invalid name");
    }
    if (body.folder !== undefined && (!body.folder.startsWith("/") || body.folder.includes(".."))) {
      return apiError(422, "VALIDATION_FAILED", "Invalid folder");
    }
    if (body.tags !== undefined && body.tags.length > 10) return apiError(422, "VALIDATION_FAILED", "Too many tags");

    if (body.name !== undefined) found.name = body.name.trim();
    if (body.folder !== undefined) found.folder = body.folder;
    if (body.tags !== undefined) found.tags = body.tags;
    touch(found);
    return HttpResponse.json(toRecord(found));
  }),

  http.post(apiPath("/files/:id/archive"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    if (found.isArchived) return apiError(409, "CONFLICT", "File is already archived");
    found.isArchived = true;
    touch(found);
    return HttpResponse.json(toRecord(found));
  }),

  http.post(apiPath("/files/:id/restore"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    if (!found.isArchived) return apiError(409, "CONFLICT", "File is not archived");
    found.isArchived = false;
    touch(found);
    return HttpResponse.json(toRecord(found));
  }),

  http.post(apiPath("/files/:id/reindex"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    // A retry of a deliberately failing demo file succeeds, so the "retry" path can be seen working.
    found.name = found.name.replace(/xəta/gi, "düzəldilmiş");
    restartProcessing(found);
    return HttpResponse.json(toRecord(found), { status: 202 });
  }),
];
