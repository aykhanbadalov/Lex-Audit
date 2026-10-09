import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Permission } from "@/shared/lib/permissions";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";
import { RequirePermission } from "./RequirePermission";

interface ModulePlaceholderProps {
  moduleKey: "invoices" | "vat" | "ledger" | "excel" | "news" | "assistant" | "approvals" | "admin";
  permission: Permission;
  phase: string;
}

/** Temporary screen for modules that arrive in later phases; it already enforces the permission. */
export function ModulePlaceholder({ moduleKey, permission, phase }: ModulePlaceholderProps) {
  const { t } = useTranslation();
  return (
    <RequirePermission permission={permission}>
      <PageHeader title={t(`nav.${moduleKey}`)} description={t(`modules.${moduleKey}`)} />
      <EmptyState
        icon={Construction}
        title={t("placeholder.title")}
        description={t("placeholder.description", { phase })}
      />
    </RequirePermission>
  );
}
