import type { ReactNode } from "react";
import { useAnyPermission } from "@/shared/hooks/usePermission";
import type { Permission } from "@/shared/lib/permissions";
import { PermissionDenied } from "./PermissionDenied";

/**
 * Shows the page only when the user holds the permission (or any of them); otherwise a 403-style state, keeping the URL.
 */
export function RequirePermission({
  permission,
  anyOf,
  children,
}: { children: ReactNode } & ({ permission: Permission; anyOf?: never } | { anyOf: Permission[]; permission?: never })) {
  const allowed = useAnyPermission(anyOf ?? [permission]);
  return allowed ? <>{children}</> : <PermissionDenied />;
}
