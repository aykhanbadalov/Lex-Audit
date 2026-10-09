import type { Permission } from "@/shared/lib/permissions";
import type { Json } from "./types";

export type BackendMe = Json<"/me">;
export type Role = "viewer" | "accountant" | "approver" | "auditor" | "admin";

export interface SessionUser {
  id: string;
  companyId: string;
  companyName: string | null;
  email: string;
  /** The backend keeps no display name yet; the e-mail is the only honest label. */
  name: string;
  /** The most senior role, for display only. Permissions decide what a person can do. */
  role: Role;
  roles: string[];
  permissions: Permission[];
}

const SENIORITY: Role[] = ["admin", "approver", "accountant", "auditor", "viewer"];

function displayRole(roles: readonly string[]): Role {
  return SENIORITY.find((role) => roles.includes(role)) ?? "viewer";
}

export function toSessionUser(me: BackendMe): SessionUser {
  return {
    id: me.id,
    companyId: me.companyId,
    companyName: me.companyName,
    email: me.email,
    name: me.email,
    role: displayRole(me.roles),
    roles: me.roles,
    permissions: me.permissions as Permission[],
  };
}
