/** Permission keys shared with the backend. The UI uses them only to show or hide things; the server enforces them. */
export const PERMISSIONS = [
  "dashboard:view",
  "invoices:read",
  "invoices:write",
  "vat:read",
  "vat:write",
  "ledger:read",
  "ledger:write",
  "excel:read",
  "news:read",
  "legislation:read",
  "files:read",
  "files:write",
  "assistant:use",
  "approvals:read",
  "approvals:decide",
  "admin:manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
