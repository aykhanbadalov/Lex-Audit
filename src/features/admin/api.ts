import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { components } from "@/api/schema";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";

export type AdminUser = components["schemas"]["AdminUser"];
export type AdminNewsSource = components["schemas"]["AdminNewsSource"];
export type ModelVersion = components["schemas"]["ModelVersion"];
export type Role = components["schemas"]["Role"];
export const ROLES: Role[] = ["viewer", "accountant", "chief_accountant", "auditor", "admin"];

const keys = { users: ["admin", "users"], sources: ["admin", "sources"], models: ["admin", "models"] } as const;

/** A change that needs approval shows up in the queue and in the audit log. */
function useRefresh() {
  const queryClient = useQueryClient();
  return (...extra: (readonly string[])[]) =>
    Promise.all(
      [["approvals"], ["audit"], ...extra].map((queryKey) =>
        queryClient.invalidateQueries({ queryKey: [...queryKey] }),
      ),
    );
}

const failed = () => toast.error(i18n.t("admin.failed"));
const sentForApproval = () => toast.success(i18n.t("admin.sentForApproval"));

export function useAdminUsers() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/users", { signal })),
  });
}

export function useUpdateUser() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (vars: { id: string; active?: boolean; role?: Role }) =>
      unwrap(
        await api.PATCH("/admin/users/{id}", {
          params: { path: { id: vars.id } },
          body: { active: vars.active, role: vars.role },
        }),
      ),
    onSuccess: async (result) => {
      // A role change answers with an approval request; anything else is applied already.
      if ("kind" in result) sentForApproval();
      else toast.success(i18n.t("admin.saved"));
      await refresh(keys.users);
    },
    onError: failed,
  });
}

export function useAdminSources() {
  return useQuery({
    queryKey: keys.sources,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/news-sources", { signal })),
  });
}

export function useUpdateSource() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) =>
      unwrap(
        await api.PATCH("/admin/news-sources/{id}", {
          params: { path: { id: vars.id } },
          body: { enabled: vars.enabled },
        }),
      ),
    onSuccess: async () => {
      toast.success(i18n.t("admin.saved"));
      await Promise.all([refresh(keys.sources), refresh(["news"])]);
    },
    onError: failed,
  });
}

export function useProposeRate() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (body: { code: string; rate: string; validFrom: string; reason: string }) =>
      unwrap(await api.POST("/admin/tax-rates/changes", { body })),
    onSuccess: async () => {
      sentForApproval();
      await refresh();
    },
    onError: failed,
  });
}

export function useModels() {
  return useQuery({
    queryKey: keys.models,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/models", { signal })),
  });
}

export function useRequestModelChange() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: async (vars: { id: string; action: "release" | "rollback"; reason: string }) =>
      unwrap(
        await api.POST("/admin/models/{id}/change", {
          params: { path: { id: vars.id } },
          body: { action: vars.action, reason: vars.reason },
        }),
      ),
    onSuccess: async () => {
      sentForApproval();
      await refresh(keys.models);
    },
    onError: failed,
  });
}
