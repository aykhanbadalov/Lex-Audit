import { delay, http, HttpResponse } from "msw";
import { ALLOWED_EXTENSIONS, extensionOf, MAX_UPLOAD_BYTES } from "@/shared/upload/limits";
import { addUploadedFile, allFiles, findFile, restartProcessing, toDetail, toRecord, touch } from "../fixtures/files";

type Stored = NonNullable<ReturnType<typeof findFile>>;

/** The backend's file record: short names, archive is a timestamp, the status is the extraction status. */
function wireRecord(stored: Stored) {
  const record = toRecord(stored);
  return {
    id: record.id,
    name: record.name,
    mime: record.mimeType,
    size: record.sizeBytes,
    folder: record.folder,
    tags: record.tags,
    ownerId: "user-accountant",
    archivedAt: record.isArchived ? record.updatedAt : null,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    extractionStatus: record.status,
  };
}

function wireExtraction(stored: Stored) {
  const detail = toDetail(stored);
  return {
    status: stored.status,
    detectedKind: "document",
    error: stored.statusDetail,
    textLength: detail.extractedTextPreview?.length ?? 0,
    updatedAt: stored.updatedAt,
  };
}

function wireDetail(stored: Stored) {
  const detail = toDetail(stored);
  return {
    ...wireRecord(stored),
    versions: detail.versions.map((version) => ({
      id: version.id,
      versionNo: version.versionNo,
      sha256: version.sha256,
      size: version.sizeBytes,
      mime: stored.mimeType,
      uploadedBy: "user-accountant",
      createdAt: version.uploadedAt,
    })),
    extraction: wireExtraction(stored),
  };
}
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

/** Tags arrive as a JSON array or a comma-separated list, like the real backend accepts them. */
function parseTags(raw: string | undefined): string[] {
  if (!raw) return [];
  if (raw.trim().startsWith("[")) return JSON.parse(raw) as string[];
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export const filesHandlers = [
  http.get(apiPath("/files"), async ({ request }) => {
    const auth = authorize(request, "files:read");
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim();
    const tag = params.get("tag");
    const includeArchived = params.get("includeArchived") === "true";
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allFiles()
      .filter(
        (file) =>
          (!q || matches(`${file.name} ${file.tags.join(" ")} ${file.folder}`, q)) &&
          (!tag || file.tags.includes(tag)) &&
          (includeArchived || !file.isArchived),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const next = offset + limit;
    return HttpResponse.json({
      items: filtered.slice(offset, next).map(wireRecord),
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
      if (found) return HttpResponse.json(wireDetail(found), { status: 201 });
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
      tags: parseTags(form.fields.get("tags")?.[0]),
    });
    uploadsByKey.set(key, created.id);
    return HttpResponse.json(wireDetail(created), { status: 201 });
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
    return found ? HttpResponse.json(wireDetail(found)) : apiError(404, "NOT_FOUND", "File not found");
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
    return HttpResponse.json(wireRecord(found));
  }),

  http.post(apiPath("/files/:id/archive"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    found.isArchived = true;
    touch(found);
    return HttpResponse.json(wireRecord(found));
  }),

  http.post(apiPath("/files/:id/restore"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    found.isArchived = false;
    touch(found);
    return HttpResponse.json(wireRecord(found));
  }),

  http.post(apiPath("/files/:id/reindex"), ({ request, params }) => {
    const auth = authorize(request, "files:write");
    if ("response" in auth) return auth.response;
    const found = findFile(String(params.id));
    if (!found) return apiError(404, "NOT_FOUND", "File not found");
    // A retry of a deliberately failing demo file succeeds, so the "retry" path can be seen working.
    found.name = found.name.replace(/xəta/gi, "düzəldilmiş");
    restartProcessing(found);
    return HttpResponse.json(wireExtraction(found), { status: 202 });
  }),
];
