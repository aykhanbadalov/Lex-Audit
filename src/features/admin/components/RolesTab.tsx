import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { usePermission } from "@/shared/hooks/usePermission";
import { PERMISSIONS } from "@/shared/lib/permissions";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { useAdminRoles, useCreateRole, useSetRolePermissions, type AdminRole } from "../api";

export function RolesTab() {
  const { t } = useTranslation();
  const roles = useAdminRoles();
  const canWrite = usePermission("roles:write");
  const [editing, setEditing] = useState<AdminRole | "new" | null>(null);

  if (roles.isPending) return <LoadingState />;
  if (roles.error) return <ErrorState message={roles.error.message} onRetry={() => void roles.refetch()} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.roles.hint")}</p>
        {canWrite ? (
          <Button type="button" size="sm" onClick={() => setEditing("new")}>
            {t("admin.roles.create")}
          </Button>
        ) : null}
      </div>
      <ul className="divide-y rounded-lg border">
        {roles.data.map((role) => (
          <li key={role.id} className="space-y-2 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="flex items-center gap-2 font-medium">
                {role.name}
                {role.system ? <Badge tone="outline">{t("admin.roles.system")}</Badge> : null}
              </p>
              {canWrite && !role.system ? (
                <Button size="sm" variant="outline" onClick={() => setEditing(role)}>
                  {t("admin.roles.edit")}
                </Button>
              ) : null}
            </div>
            {role.description ? <p className="text-xs text-muted-foreground">{role.description}</p> : null}
            <p className="flex flex-wrap gap-1">
              {role.permissions.map((permission) => (
                <Badge key={permission} tone="neutral" className="font-mono">
                  {permission}
                </Badge>
              ))}
            </p>
          </li>
        ))}
      </ul>
      {editing ? <RoleDialog role={editing === "new" ? null : editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function RoleDialog({ role, onClose }: { role: AdminRole | null; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateRole();
  const update = useSetRolePermissions();
  // A role can only hand out permissions its creator holds; the backend refuses the rest.
  const mine = useAuthStore((state) => state.user?.permissions ?? []);
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []));
  const valid = (role !== null || name.trim().length >= 2) && selected.size > 0;
  const busy = create.isPending || update.isPending;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{role ? t("admin.roles.editTitle", { name: role.name }) : t("admin.roles.create")}</DialogTitle>
          <DialogDescription>{t("admin.roles.subset")}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!valid) return;
            const permissions = [...selected];
            if (role) update.mutate({ id: role.id, permissions }, { onSuccess: onClose });
            else
              create.mutate(
                { name: name.trim(), description: description.trim() || undefined, permissions },
                { onSuccess: onClose },
              );
          }}
        >
          {role ? null : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="role-name">{t("admin.roles.name")}</Label>
                <Input id="role-name" maxLength={60} value={name} onChange={(event) => setName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role-description">{t("admin.roles.description")}</Label>
                <Input
                  id="role-description"
                  maxLength={300}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
              </div>
            </>
          )}
          <fieldset className="grid max-h-64 gap-1.5 overflow-auto sm:grid-cols-2">
            <legend className="sr-only">{t("admin.roles.permissions")}</legend>
            {PERMISSIONS.map((permission) => (
              <label key={permission} className="flex items-center gap-2 font-mono text-xs">
                <input
                  type="checkbox"
                  className="size-4"
                  disabled={!(mine as readonly string[]).includes(permission)}
                  checked={selected.has(permission)}
                  onChange={(event) => {
                    const next = new Set(selected);
                    if (event.target.checked) next.add(permission);
                    else next.delete(permission);
                    setSelected(next);
                  }}
                />
                {permission}
              </label>
            ))}
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || busy}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
