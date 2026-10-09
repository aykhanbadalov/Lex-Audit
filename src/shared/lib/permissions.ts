/** Permission codes exactly as the backend issues them (`GET /me`). The UI only shows or hides; the server enforces. */
export const PERMISSIONS = [
  "users:read",
  "users:write",
  "roles:read",
  "roles:write",
  "invoices:read",
  "invoices:write",
  "vat:read",
  "vat:write",
  "journal:read",
  "journal:write",
  "approvals:read",
  "approvals:decide",
  "audit:read",
  "admin:health",
  "assistant:use",
  "excel:use",
  "files:read",
  "files:write",
  "impact:read",
  "impact:write",
  "imports:commit",
  "legislation:read",
  "news:read",
  "platform:admin",
] as const;

export type Permission = (typeof PERMISSIONS)[number];
