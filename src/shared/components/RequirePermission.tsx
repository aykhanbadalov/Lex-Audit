import type { ReactNode } from "react";
import { usePermission } from "@/shared/hooks/usePermission";
import type { Permission } from "@/shared/lib/permissions";
import { PermissionDenied } from "./PermissionDenied";

/** Shows the page only when the user holds the permission; otherwise a 403-style state, keeping the URL. */
export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <PermissionDenied />;
}
