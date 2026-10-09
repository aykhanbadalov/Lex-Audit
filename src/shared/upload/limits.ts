/**
 * Mirrors the limits the backend enforces (BACKEND_REQUIREMENTS.md §6). Checking first only gives a faster, clearer
 * message; the server stays the authority and answers 413 / 415 itself.
 */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ALLOWED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg", "xlsx", "xls", "csv", "xml", "zip"] as const;

export type UploadRejection = "empty" | "tooLarge" | "unsupportedType";

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot < 0 ? "" : name.slice(dot + 1).toLowerCase();
}

/** Returns why a file cannot be uploaded, or null when it can. */
export function checkUpload(file: { name: string; size: number }): UploadRejection | null {
  if (file.size === 0) return "empty";
  if (file.size > MAX_UPLOAD_BYTES) return "tooLarge";
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(file.name))) return "unsupportedType";
  return null;
}
