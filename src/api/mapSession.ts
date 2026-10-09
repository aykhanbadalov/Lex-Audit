import type { components } from "./schema";
import type { paths } from "./real/schema";

export type BackendMe = paths["/api/v1/me"]["get"]["responses"][200]["content"]["application/json"];
export type SessionUser = components["schemas"]["User"];
type Role = SessionUser["role"];

/**
 * The backend names permissions by what they protect; the screens were written against finer-grained names.
 * This is the one place that translates, so a screen never has to know the backend's vocabulary. Unknown codes pass
 * through untouched, and a screen that still checks an old name simply stays hidden (fail closed).
 */
const IMPLIES: Record<string, string[]> = {
  "journal:read": ["ledger:read"],
  "journal:write": ["ledger:write"],
  "excel:use": ["excel:read", "excel:write", "reconciliation:read", "reconciliation:write"],
  "imports:commit": ["integrations:read", "integrations:write"],
  "files:read": ["integrations:read"],
  "users:read": ["admin:manage"],
  "platform:admin": ["admin:manage"],
};

export function fromBackendPermissions(codes: readonly string[]): string[] {
  const result = new Set<string>(["dashboard:view"]);
  for (const code of codes) {
    result.add(code);
    for (const implied of IMPLIES[code] ?? []) result.add(implied);
  }
  return [...result];
}

/** The role shown next to the name. Permissions, not this label, decide what a person can do. */
function displayRole(roles: readonly string[]): Role {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("approver")) return "chief_accountant";
  if (roles.includes("accountant")) return "accountant";
  if (roles.includes("auditor")) return "auditor";
  return "viewer";
}

export function toSessionUser(me: BackendMe): SessionUser {
  return {
    id: me.id,
    companyId: me.companyId,
    // The backend keeps no display name yet; the e-mail is the only honest label.
    name: me.email,
    email: me.email,
    role: displayRole(me.roles),
    permissions: fromBackendPermissions(me.permissions) as SessionUser["permissions"],
  };
}
