import type { SourceSpec } from "./api";

export type SourceDraft =
  | { type: "file"; fileId: string; keyColumn: string; amountColumn: string; dateColumn: string }
  | { type: "invoices"; from: string; to: string; direction: "" | "sales" | "purchase" }
  | { type: "bank"; from: string; to: string };

export const emptyDraft = (type: SourceDraft["type"]): SourceDraft =>
  type === "file"
    ? { type, fileId: "", keyColumn: "", amountColumn: "", dateColumn: "" }
    : type === "invoices"
      ? { type, from: "", to: "", direction: "" }
      : { type, from: "", to: "" };

/** Whether the draft has everything the backend needs. The backend checks again. */
export function isComplete(draft: SourceDraft): boolean {
  if (draft.type === "file") return Boolean(draft.fileId && draft.keyColumn.trim() && draft.amountColumn.trim());
  if (draft.type === "invoices") return Boolean(draft.from && draft.to);
  return true;
}

export function toSpec(draft: SourceDraft): SourceSpec {
  if (draft.type === "file") {
    return {
      type: "file",
      fileId: draft.fileId,
      keyColumn: draft.keyColumn.trim(),
      amountColumn: draft.amountColumn.trim(),
      dateColumn: draft.dateColumn.trim() || undefined,
    };
  }
  if (draft.type === "invoices") {
    return { type: "invoices", from: draft.from, to: draft.to, direction: draft.direction || undefined };
  }
  return { type: "bank", from: draft.from || undefined, to: draft.to || undefined };
}
