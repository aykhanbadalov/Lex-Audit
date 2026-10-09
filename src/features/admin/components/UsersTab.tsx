import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { formatDateTime } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Select } from "@/shared/ui/select";
import { ROLES, useAdminUsers, useUpdateUser, type AdminUser, type Role } from "../api";

export function UsersTab() {
  const { t, i18n } = useTranslation();
  const users = useAdminUsers();
  const update = useUpdateUser();
  const me = useAuthStore((state) => state.user?.id);
  const [deactivating, setDeactivating] = useState<AdminUser | null>(null);
  const tag = localeTag(i18n.language);

  if (users.isPending) return <LoadingState />;
  if (users.error) return <ErrorState message={users.error.message} onRetry={() => void users.refetch()} />;

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">{t("admin.users.hint")}</p>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {(["user", "role", "status", "lastLogin"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium">
                  {t(`admin.users.${column}`)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2 font-medium">
                <span className="sr-only">{t("admin.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => {
              const self = user.id === me;
              return (
                <tr key={user.id} className="border-t">
                  <td className="px-3 py-2">
                    <span className="block font-medium">{user.name}</span>
                    <span className="block text-xs text-muted-foreground">{user.email}</span>
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      aria-label={t("admin.users.roleOf", { name: user.name })}
                      value={user.role}
                      disabled={self || update.isPending}
                      onChange={(event) => update.mutate({ id: user.id, role: event.target.value as Role })}
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {t(`admin.roles.${role}`)}
                        </option>
                      ))}
                    </Select>
                    {user.pendingRole ? (
                      <Badge tone="warning" className="mt-1">
                        {t("admin.users.pendingRole", { role: t(`admin.roles.${user.pendingRole}`) })}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={user.active ? "success" : "neutral"}>
                      {t(user.active ? "admin.users.active" : "admin.users.inactive")}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt, tag) : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {self ? (
                      <span className="text-xs text-muted-foreground">{t("admin.users.you")}</span>
                    ) : user.active ? (
                      <Button size="sm" variant="outline" onClick={() => setDeactivating(user)}>
                        {t("admin.users.deactivate")}
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => update.mutate({ id: user.id, active: true })}>
                        {t("admin.users.activate")}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(open) => !open && setDeactivating(null)}
        title={t("admin.users.deactivateTitle", { name: deactivating?.name })}
        description={t("admin.users.deactivateDescription")}
        confirmLabel={t("admin.users.deactivate")}
        destructive
        busy={update.isPending}
        onConfirm={() => {
          if (deactivating)
            update.mutate({ id: deactivating.id, active: false }, { onSettled: () => setDeactivating(null) });
        }}
      />
    </>
  );
}
