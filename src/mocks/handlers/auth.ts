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
  "excel:write",
  "reconciliation:read",
  "reconciliation:write",
  "integrations:read",
  "integrations:write",
  "news:read",
  "legislation:read",
  "files:read",
  "files:write",
  "vat:write",
  "ledger:write",
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
    permissions: [...ACCOUNTANT_PERMISSIONS, "approvals:read", "approvals:decide", "audit:read"],
  },
  "admin@lexaudit.test": {
    id: "user-admin",
    companyId: "company-demo",
    name: "Nigar Quliyeva",
    email: "admin@lexaudit.test",
    role: "admin",
    permissions: [...ACCOUNTANT_PERMISSIONS, "approvals:read", "approvals:decide", "audit:read", "admin:manage"],
  },
  // Reads everything and writes nothing: used to test that write actions stay hidden.
  "auditor@lexaudit.test": {
    id: "user-auditor",
    companyId: "company-demo",
    name: "Səbinə Rzayeva",
    email: "auditor@lexaudit.test",
    role: "auditor",
    permissions: [
      ...ACCOUNTANT_PERMISSIONS.filter((permission) => !permission.endsWith(":write")),
      "approvals:read",
      "audit:read",
    ],
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

/** The backend's own permission names, derived from the finer-grained ones the mock users are written with. */
function toBackendPermissions(user: User): string[] {
  const out = new Set<string>();
  for (const permission of user.permissions) {
    if (permission === "dashboard:view") continue;
    if (permission.startsWith("ledger:")) out.add(permission.replace("ledger:", "journal:"));
    else if (/^(excel|reconciliation):/.test(permission)) out.add("excel:use");
    else if (permission === "integrations:write") out.add("imports:commit");
    else if (permission === "integrations:read") out.add("files:read");
    else if (permission === "admin:manage")
      ["users:read", "users:write", "roles:read", "roles:write", "platform:admin"].forEach((p) => out.add(p));
    else out.add(permission);
  }
  return [...out];
}

const BACKEND_ROLE: Record<User["role"], string> = {
  viewer: "viewer",
  accountant: "accountant",
  chief_accountant: "approver",
  auditor: "viewer",
  admin: "admin",
};

const csrfFor = (user: User) => `mock-csrf-${user.id}`;

function tokens(user: User) {
  return { accessToken: `mock-token-${user.id}`, csrfToken: csrfFor(user), expiresInSeconds: 15 * 60 };
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

/** Like `authorize`, but any one of the permissions is enough. */
export function authorizeAny(request: Request, permissions: string[]): { user: User } | { response: Response } {
  const attempts = permissions.map((permission) => authorize(request, permission));
  const allowed = attempts.find((attempt) => "user" in attempt);
  return allowed ?? attempts[attempts.length - 1]!;
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
    return HttpResponse.json(tokens(user));
  }),

  // After a page reload the CSRF token is gone from memory; the backend derives it again from the refresh cookie.
  http.get(apiPath("/auth/csrf"), () => {
    const email = getMockRefreshUser();
    const user = email ? mockUsers[email] : undefined;
    return user
      ? HttpResponse.json({ csrfToken: csrfFor(user) })
      : apiError(401, "UNAUTHENTICATED", "Missing refresh token cookie");
  }),

  http.post(apiPath("/auth/refresh"), ({ request }) => {
    const email = getMockRefreshUser();
    const user = email ? mockUsers[email] : undefined;
    if (!user) {
      return apiError(401, "UNAUTHENTICATED", "Missing refresh token cookie");
    }
    if (request.headers.get("X-CSRF-Token") !== csrfFor(user)) {
      return apiError(403, "FORBIDDEN", "Missing or invalid CSRF token");
    }
    return HttpResponse.json(tokens(user));
  }),

  http.get(apiPath("/me"), ({ request }) => {
    const token = /^Bearer (.+)$/.exec(request.headers.get("Authorization") ?? "")?.[1];
    const user = Object.values(mockUsers).find((candidate) => `mock-token-${candidate.id}` === token);
    if (!user) return apiError(401, "UNAUTHENTICATED", "Missing or expired access token");
    return HttpResponse.json({
      id: user.id,
      email: user.email,
      status: "active",
      companyId: user.companyId,
      companyName: "Demo MMC",
      roles: [BACKEND_ROLE[user.role]],
      permissions: toBackendPermissions(user),
    });
  }),

  http.post(apiPath("/auth/logout"), ({ request }) => {
    const email = getMockRefreshUser();
    const user = email ? mockUsers[email] : undefined;
    if (user && request.headers.get("X-CSRF-Token") !== csrfFor(user)) {
      return apiError(403, "FORBIDDEN", "Missing or invalid CSRF token");
    }
    setMockRefreshUser(null);
    return HttpResponse.json({ status: "ok" });
  }),
];
