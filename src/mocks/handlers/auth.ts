import { http, HttpResponse } from "msw";
import type { components } from "@/api/schema";

type User = components["schemas"]["User"];

const DEMO_PASSWORD = "demo1234";

const ACCOUNTANT_PERMISSIONS = [
  "dashboard:view",
  "invoices:read",
  "invoices:write",
  "vat:read",
  "ledger:read",
  "excel:read",
  "news:read",
  "assistant:use",
];

export const mockUsers: Record<string, User> = {
  "muhasib@lexaudit.test": {
    id: "user-accountant",
    companyId: "company-demo",
    name: "Aygün Məmmədova",
    email: "muhasib@lexaudit.test",
    role: "accountant",
    permissions: ACCOUNTANT_PERMISSIONS,
  },
  "bas.muhasib@lexaudit.test": {
    id: "user-chief",
    companyId: "company-demo",
    name: "Elçin Həsənov",
    email: "bas.muhasib@lexaudit.test",
    role: "chief_accountant",
    permissions: [...ACCOUNTANT_PERMISSIONS, "approvals:read", "approvals:decide"],
  },
  "admin@lexaudit.test": {
    id: "user-admin",
    companyId: "company-demo",
    name: "Nigar Quliyeva",
    email: "admin@lexaudit.test",
    role: "admin",
    permissions: [...ACCOUNTANT_PERMISSIONS, "approvals:read", "approvals:decide", "admin:manage"],
  },
};

export const authHandlers = [
  http.post("*/auth/login", async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = body.email ? mockUsers[body.email.toLowerCase()] : undefined;

    // The mock enforces credentials like the real backend must (audit A-01).
    if (!user || body.password !== DEMO_PASSWORD) {
      return HttpResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Invalid credentials", requestId: crypto.randomUUID() } },
        { status: 401 },
      );
    }

    const session: components["schemas"]["Session"] = {
      accessToken: `mock-token-${user.id}`,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      user,
    };
    return HttpResponse.json(session);
  }),
];
