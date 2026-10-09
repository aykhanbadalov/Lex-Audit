import { useAuthStore } from "@/shared/stores/authStore";

/** UI-only check. The backend enforces every permission again (audit A-02). */
export function usePermission(permission: string): boolean {
  return useAuthStore(
    (state) => (state.user?.permissions as readonly string[] | undefined)?.includes(permission) ?? false,
  );
}

/** True when the user holds at least one of the permissions. */
export function useAnyPermission(permissions: readonly string[]): boolean {
  return useAuthStore((state) =>
    permissions.some((permission) => (state.user?.permissions as readonly string[] | undefined)?.includes(permission)),
  );
}
