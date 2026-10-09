import { useAuthStore } from "@/shared/stores/authStore";

/** UI-only check. The backend enforces every permission again (audit A-02). */
export function usePermission(permission: string): boolean {
  return useAuthStore((state) => state.user?.permissions.includes(permission) ?? false);
}
