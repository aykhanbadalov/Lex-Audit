import { http, HttpResponse } from "msw";
import type { components } from "@/api/schema";
import { getMockRefreshUser, setMockRefreshUser } from "../refreshCookie";
import { apiPath } from "./base";

type User = components["schemas"]["User"];
type ErrorCode = components["schemas"]["ApiError"]["error"]["code"];

const DEMO_PASSWORD = "demo1234";

const ACCOUNTANT_PERMISSIONS = [
  "dashboard:view",
  "invoices:read",
  "invoices:write",
  "vat:read",
  "ledger:read",
  "excel:read",
  "news:read",
  "legislation:read",
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
  // Used to test the "no access" path: signed in, but allowed to see nothing.
  "viewer@lexaudit.test": {
    id: "user-viewer",
    companyId: "company-demo",
    name: "Rəşad Əliyev",
    email: "viewer@lexaudit.test",
    role: "viewer",
    permissions: ["dashboard:view"],
  },
};

export function apiError(status: number, code: ErrorCode, message: string): Response {
  return HttpResponse.json({ error: { code, message, requestId: crypto.randomUUID() } }, { status });
}

function newSession(user: User): components["schemas"]["Session"] {
  return {
    accessToken: `mock-token-${user.id}`,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    user,
  };
}

/** Mirrors what the real backend must do on every protected route: authenticate, then authorize. */
export function authorize(request: Request, permission: string): { user: User } | { response: Response } {
  const token = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "")?.[1];
  const user = Object.values(mockUsers).find((candidate) => `mock-token-${candidate.id}` === token);
  if (!user) {
    return { response: apiError(401, "UNAUTHENTICATED", "Missing or expired access token") };
  }
  if (!user.permissions.includes(permission)) {
    return { response: apiError(403, "FORBIDDEN", `Missing permission ${permission}`) };
  }
  return { user };
}

export const authHandlers = [
  http.post(apiPath("/auth/login"), async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    const user = body.email ? mockUsers[body.email.toLowerCase()] : undefined;

    // The mock enforces credentials like the real backend must (audit A-01).
    if (!user || body.password !== DEMO_PASSWORD) {
      return apiError(401, "UNAUTHENTICATED", "Invalid credentials");
    }
    setMockRefreshUser(user.email);
    return HttpResponse.json(newSession(user));
  }),

  http.post(apiPath("/auth/refresh"), () => {
    const email = getMockRefreshUser();
    const user = email ? mockUsers[email] : undefined;
    if (!user) {
      return apiError(401, "UNAUTHENTICATED", "No valid refresh token");
    }
    return HttpResponse.json(newSession(user));
  }),

  http.post(apiPath("/auth/logout"), () => {
    setMockRefreshUser(null);
    return new HttpResponse(null, { status: 204 });
  }),
];
