import { describe, expect, it } from "vitest";
import { mockUsers } from "@/mocks/handlers/auth";
import { NAV_ITEMS, visibleNavItems } from "@/app/navigation";

describe("navigation", () => {
  it("shows an accountant only the sections they may read", () => {
    const accountant = mockUsers["muhasib@lexaudit.test"];
    const targets = visibleNavItems(accountant?.permissions ?? []).map((item) => item.to);
    expect(targets).toContain("/invoices");
    expect(targets).not.toContain("/audit-log");
    expect(targets).not.toContain("/admin");
  });

  it("shows the admin everything", () => {
    const admin = mockUsers["admin@lexaudit.test"];
    expect(visibleNavItems(admin?.permissions ?? [])).toHaveLength(NAV_ITEMS.length);
  });

  it("shows a user without permissions only the start page", () => {
    expect(visibleNavItems([]).map((item) => item.to)).toEqual(["/dashboard"]);
  });
});
