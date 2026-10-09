import {
  BookOpenCheck,
  Bot,
  FileSpreadsheet,
  GitCompareArrows,
  Files,
  Gauge,
  Newspaper,
  PlugZap,
  Percent,
  Receipt,
  Scale,
  Settings,
  ScrollText,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/shared/lib/permissions";

export interface NavItem {
  to:
    | "/dashboard"
    | "/invoices"
    | "/vat"
    | "/ledger"
    | "/files"
    | "/excel"
    | "/reconciliation"
    | "/integrations"
    | "/news"
    | "/legislation"
    | "/assistant"
    | "/approvals"
    | "/audit-log"
    | "/admin";
  labelKey: `nav.${string}`;
  icon: LucideIcon;
  /** Everyone signed in sees the item when neither field is set. */
  permission?: Permission;
  anyOf?: Permission[];
  group: "work" | "knowledge" | "governance";
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", labelKey: "nav.dashboard", icon: Gauge, group: "work" },
  { to: "/invoices", labelKey: "nav.invoices", icon: Receipt, permission: "invoices:read", group: "work" },
  { to: "/vat", labelKey: "nav.vat", icon: Percent, permission: "vat:read", group: "work" },
  { to: "/ledger", labelKey: "nav.ledger", icon: BookOpenCheck, permission: "journal:read", group: "work" },
  { to: "/files", labelKey: "nav.files", icon: Files, permission: "files:read", group: "work" },
  { to: "/excel", labelKey: "nav.excel", icon: FileSpreadsheet, permission: "excel:use", group: "work" },
  {
    to: "/reconciliation",
    labelKey: "nav.reconciliation",
    icon: GitCompareArrows,
    permission: "excel:use",
    group: "work",
  },
  { to: "/integrations", labelKey: "nav.integrations", icon: PlugZap, permission: "excel:use", group: "work" },
  { to: "/news", labelKey: "nav.news", icon: Newspaper, permission: "news:read", group: "knowledge" },
  { to: "/legislation", labelKey: "nav.legislation", icon: Scale, permission: "legislation:read", group: "knowledge" },
  { to: "/assistant", labelKey: "nav.assistant", icon: Bot, permission: "assistant:use", group: "knowledge" },
  { to: "/approvals", labelKey: "nav.approvals", icon: ShieldCheck, permission: "approvals:read", group: "governance" },
  { to: "/audit-log", labelKey: "nav.audit", icon: ScrollText, permission: "audit:read", group: "governance" },
  {
    to: "/admin",
    labelKey: "nav.admin",
    icon: Settings,
    anyOf: ["users:read", "roles:read", "platform:admin"],
    group: "governance",
  },
];

export const NAV_GROUPS: NavItem["group"][] = ["work", "knowledge", "governance"];

export function visibleNavItems(permissions: readonly string[]): NavItem[] {
  return NAV_ITEMS.filter((item) =>
    item.permission
      ? permissions.includes(item.permission)
      : item.anyOf
        ? item.anyOf.some((code) => permissions.includes(code))
        : true,
  );
}
