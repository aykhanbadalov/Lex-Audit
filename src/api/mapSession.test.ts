import { describe, expect, it } from "vitest";
import { fromBackendPermissions, toSessionUser, type BackendMe } from "./mapSession";

const me = (roles: string[], permissions: string[]): BackendMe => ({
  id: "u1",
  email: "a@b.az",
  status: "active",
  companyId: "c1",
  companyName: "MMC",
  roles,
  permissions,
});

describe("fromBackendPermissions", () => {
  it("lets everyone in to the dashboard and keeps the backend's own codes", () => {
    expect(fromBackendPermissions(["invoices:read"])).toEqual(
      expect.arrayContaining(["dashboard:view", "invoices:read"]),
    );
  });

  it("translates the codes whose names differ", () => {
    const result = fromBackendPermissions(["journal:write", "excel:use", "imports:commit", "users:read"]);
    expect(result).toEqual(
      expect.arrayContaining([
        "ledger:write",
        "excel:write",
        "reconciliation:read",
        "integrations:write",
        "admin:manage",
      ]),
    );
  });

  it("never grants a write that was not given", () => {
    const result = fromBackendPermissions(["journal:read", "invoices:read"]);
    expect(result).not.toContain("ledger:write");
    expect(result).not.toContain("invoices:write");
    expect(result).not.toContain("admin:manage");
  });
});

describe("toSessionUser", () => {
  it("shows the most senior role and uses the e-mail as the name", () => {
    expect(toSessionUser(me(["viewer", "admin"], [])).role).toBe("admin");
    expect(toSessionUser(me(["approver"], [])).role).toBe("chief_accountant");
    expect(toSessionUser(me([], [])).role).toBe("viewer");
    expect(toSessionUser(me(["accountant"], [])).name).toBe("a@b.az");
  });
});
