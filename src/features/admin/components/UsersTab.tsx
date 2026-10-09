import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import { ErrorState } from "@/shared/components/ErrorState";
import { LoadingState } from "@/shared/components/LoadingState";
import { usePermission } from "@/shared/hooks/usePermission";
import { formatDate } from "@/shared/lib/date";
import { localeTag } from "@/shared/lib/locale";
import { useAuthStore } from "@/shared/stores/authStore";
import { Badge, type BadgeTone } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  useAdminRoles,
  useAdminUsers,
  useCreateUser,
  useSetUserRoles,
  useSetUserStatus,
  type AdminRole,
  type AdminUser,
} from "../api";

const TONE: Record<AdminUser["status"], BadgeTone> = { active: "success", pending: "warning", suspended: "neutral" };
const MIN_PASSWORD = 12;

export function UsersTab() {
  const { t, i18n } = useTranslation();
  const users = useAdminUsers();
  const roles = useAdminRoles();
  const canWrite = usePermission("users:write");
  const me = useAuthStore((state) => state.user?.id);
  const setStatus = useSetUserStatus();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [suspending, setSuspending] = useState<AdminUser | null>(null);
  const tag = localeTag(i18n.language);

  if (users.isPending) return <LoadingState />;
  if (users.error) return <ErrorState message={users.error.message} onRetry={() => void users.refetch()} />;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("admin.users.hint")}</p>
        {canWrite ? (
          <Button type="button" size="sm" onClick={() => setCreating(true)}>
            {t("admin.users.create")}
          </Button>
        ) : null}
      </div>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              {(["user", "roles", "status", "created"] as const).map((column) => (
                <th key={column} scope="col" className="px-3 py-2 font-medium">
                  {t(`admin.users.${column}`)}
                </th>
              ))}
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">{t("admin.actions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {users.data.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="px-3 py-2 font-medium">{user.email}</td>
                <td className="px-3 py-2">
                  <span className="flex flex-wrap gap-1">
                    {user.roles.map((role) => (
                      <Badge key={role} tone="outline">
                        {role}
                      </Badge>
                    ))}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <Badge tone={TONE[user.status]}>{t(`admin.users.statuses.${user.status}`)}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(user.createdAt, tag)}</td>
                <td className="px-3 py-2 text-right">
                  {user.id === me ? (
                    <span className="text-xs text-muted-foreground">{t("admin.users.you")}</span>
                  ) : canWrite ? (
                    <span className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(user)}>
                        {t("admin.users.changeRoles")}
                      </Button>
                      {user.status === "suspended" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setStatus.mutate({ id: user.id, status: "active" })}
                        >
                          {t("admin.users.activate")}
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setSuspending(user)}>
                          {t("admin.users.suspend")}
                        </Button>
                      )}
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {creating ? <CreateUserDialog roles={roles.data ?? []} onClose={() => setCreating(false)} /> : null}
      {editing ? <RolesDialog user={editing} roles={roles.data ?? []} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={suspending !== null}
        onOpenChange={(open) => !open && setSuspending(null)}
        title={t("admin.users.suspendTitle", { name: suspending?.email })}
        description={t("admin.users.suspendDescription")}
        confirmLabel={t("admin.users.suspend")}
        destructive
        busy={setStatus.isPending}
        onConfirm={() => {
          if (suspending)
            setStatus.mutate({ id: suspending.id, status: "suspended" }, { onSettled: () => setSuspending(null) });
        }}
      />
    </>
  );
}

function RoleChecks({
  roles,
  selected,
  onChange,
}: {
  roles: AdminRole[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}) {
  return (
    <fieldset className="space-y-1.5">
      {roles.map((role) => (
        <label key={role.id} className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5 size-4"
            checked={selected.has(role.id)}
            onChange={(event) => {
              const next = new Set(selected);
              if (event.target.checked) next.add(role.id);
              else next.delete(role.id);
              onChange(next);
            }}
          />
          <span>
            <span className="font-medium">{role.name}</span>
            {role.description ? <span className="block text-xs text-muted-foreground">{role.description}</span> : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function CreateUserDialog({ roles, onClose }: { roles: AdminRole[]; onClose: () => void }) {
  const { t } = useTranslation();
  const create = useCreateUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const valid = /^\S+@\S+\.\S+$/.test(email) && password.length >= MIN_PASSWORD && selected.size > 0;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.create")}</DialogTitle>
          <DialogDescription>{t("admin.users.createHint", { count: MIN_PASSWORD })}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (valid) create.mutate({ email: email.trim(), password, roleIds: [...selected] }, { onSuccess: onClose });
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-user-email">{t("auth.email")}</Label>
            <Input
              id="new-user-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-user-password">{t("admin.users.temporaryPassword")}</Label>
            <Input
              id="new-user-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <RoleChecks roles={roles} selected={selected} onChange={setSelected} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || create.isPending}>
              {t("admin.users.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RolesDialog({ user, roles, onClose }: { user: AdminUser; roles: AdminRole[]; onClose: () => void }) {
  const { t } = useTranslation();
  const setRoles = useSetUserRoles();
  const [selected, setSelected] = useState(
    () => new Set(roles.filter((role) => user.roles.includes(role.name)).map((role) => role.id)),
  );
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.rolesOf", { name: user.email })}</DialogTitle>
          <DialogDescription>{t("admin.users.rolesHint")}</DialogDescription>
        </DialogHeader>
        <RoleChecks roles={roles} selected={selected} onChange={setSelected} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={selected.size === 0 || setRoles.isPending}
            onClick={() => setRoles.mutate({ id: user.id, roleIds: [...selected] }, { onSuccess: onClose })}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
