import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import type { Body, Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import { i18n } from "@/app/i18n";
import { useAnyPermission } from "@/shared/hooks/usePermission";

export type AdminUser = Item<Json<"/admin/users">>;
export type AdminRole = Item<Json<"/admin/roles">>;
export type AdminSource = Item<Json<"/admin/sources">>;
export type AdminRate = Item<Json<"/admin/tax-rates">>;
export type ModelRegistry = Json<"/admin/models">;
export type ModelVersion = Item<ModelRegistry["versions"]>;
export type ModelStatus = ModelVersion["status"];
export type AdminAlert = Item<Json<"/admin/alerts">>;
export type NewRate = Body<"/admin/tax-rates">;
export type NewModel = Body<"/admin/models">;

const keys = {
  users: ["admin", "users"],
  roles: ["admin", "roles"],
  sources: ["admin", "sources"],
  rates: ["admin", "rates"],
  models: ["admin", "models"],
  alerts: ["admin", "alerts"],
} as const;

const failed = () => toast.error(i18n.t("admin.failed"));

/** Runs a change, then re-reads what it touched and the audit log. */
function useChange<TVars, TResult>(
  run: (vars: TVars) => Promise<TResult>,
  refresh: readonly (readonly string[])[],
  success: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      toast.success(i18n.t(success));
      await Promise.all(
        [...refresh, ["audit"], ["approvals"]].map((queryKey) =>
          queryClient.invalidateQueries({ queryKey: [...queryKey] }),
        ),
      );
    },
    onError: failed,
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: keys.users,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/users", { signal })),
  });
}
export function useAdminRoles() {
  // Roles are needed to hand them out, so anyone who may list users may read them too.
  const allowed = useAnyPermission(["roles:read", "users:read"]);
  return useQuery({
    queryKey: keys.roles,
    enabled: allowed,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/roles", { signal })),
  });
}
export function useAdminSources() {
  return useQuery({
    queryKey: keys.sources,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/sources", { signal })),
  });
}
export function useAdminRates() {
  return useQuery({
    queryKey: keys.rates,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/tax-rates", { signal })),
  });
}
export function useModelRegistry() {
  return useQuery({
    queryKey: keys.models,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/models", { signal })),
  });
}
export function useAdminAlerts() {
  return useQuery({
    queryKey: keys.alerts,
    queryFn: async ({ signal }) => unwrap(await api.GET("/admin/alerts", { signal })),
  });
}

export const useCreateUser = () =>
  useChange(
    async (body: Body<"/admin/users">) => unwrap(await api.POST("/admin/users", { body })),
    [keys.users],
    "admin.users.createdOk",
  );
export const useSetUserStatus = () =>
  useChange(
    async (vars: { id: string; status: "active" | "suspended" }) =>
      unwrap(
        await api.PATCH("/admin/users/{id}", { params: { path: { id: vars.id } }, body: { status: vars.status } }),
      ),
    [keys.users],
    "admin.saved",
  );
export const useSetUserRoles = () =>
  useChange(
    async (vars: { id: string; roleIds: string[] }) =>
      unwrap(
        await api.PUT("/admin/users/{id}/roles", {
          params: { path: { id: vars.id } },
          body: { roleIds: vars.roleIds },
        }),
      ),
    [keys.users],
    "admin.saved",
  );
export const useCreateRole = () =>
  useChange(
    async (body: Body<"/admin/roles">) => unwrap(await api.POST("/admin/roles", { body })),
    [keys.roles],
    "admin.roles.createdOk",
  );
export const useSetRolePermissions = () =>
  useChange(
    async (vars: { id: string; permissions: string[] }) =>
      unwrap(
        await api.PUT("/admin/roles/{id}/permissions", {
          params: { path: { id: vars.id } },
          body: { permissions: vars.permissions },
        }),
      ),
    [keys.roles, keys.users],
    "admin.saved",
  );
export const useUpdateSource = () =>
  useChange(
    async (vars: { id: string; enabled?: boolean; fetchCron?: string }) =>
      unwrap(
        await api.PUT("/admin/sources/{id}", {
          params: { path: { id: vars.id } },
          body: { enabled: vars.enabled, fetchCron: vars.fetchCron },
        }),
      ),
    [keys.sources, ["news"]],
    "admin.saved",
  );
export const useProposeRate = () =>
  useChange(
    async (body: NewRate) => unwrap(await api.POST("/admin/tax-rates", { body })),
    [keys.rates, ["tax-rates"]],
    "admin.rates.proposedOk",
  );
export const useRequestActivation = () =>
  useChange(
    async (id: string) =>
      unwrap(await api.POST("/admin/tax-rates/{id}/request-activation", { params: { path: { id } } })),
    [keys.rates],
    "admin.sentForApproval",
  );
export const useRegisterModel = () =>
  useChange(
    async (body: NewModel) => unwrap(await api.POST("/admin/models", { body })),
    [keys.models],
    "admin.models.registeredOk",
  );
export const useSetModelStatus = () =>
  useChange(
    async (vars: { id: string; status: ModelStatus }) =>
      unwrap(
        await api.PUT("/admin/models/{id}/status", {
          params: { path: { id: vars.id } },
          body: { status: vars.status },
        }),
      ),
    [keys.models],
    "admin.saved",
  );
