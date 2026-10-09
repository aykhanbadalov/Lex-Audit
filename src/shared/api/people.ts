import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { unwrap } from "@/api/unwrap";
import { useAnyPermission } from "@/shared/hooks/usePermission";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * The backend names people by id only. Anyone allowed to list users gets e-mail addresses for the ids; everyone else
 * sees "you" for themselves and a short id for the rest, instead of a guess.
 */
export function usePeople(): (id: string | null | undefined) => string {
  const me = useAuthStore((state) => state.user);
  const allowed = useAnyPermission(["users:read"]);
  const users = useQuery({
    queryKey: ["admin", "users"],
    enabled: allowed,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/users", { signal })),
    staleTime: 60_000,
  });
  const byId = new Map((users.data ?? []).map((user) => [user.id, user.email]));
  return (id) => {
    if (!id) return "—";
    if (id === me?.id) return me.email;
    return byId.get(id) ?? id.slice(0, 8);
  };
}
