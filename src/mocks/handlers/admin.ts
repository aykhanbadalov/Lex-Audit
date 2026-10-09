// The admin area in the shapes the real backend sends: users and roles, news sources, tax rates, model versions.
import { http, HttpResponse } from "msw";
import { addApprovalRequest, registerEffect } from "../fixtures/approvals";
import { recordAudit } from "../fixtures/audit";
import { taxRates } from "../fixtures/invoices";
import { newsSources } from "../fixtures/news";
import { apiError, authorize, mockUsers, type MockUser } from "./auth";
import { apiPath } from "./base";

const PERMISSION_CODES = [
  "users:read",
  "users:write",
  "roles:read",
  "roles:write",
  "invoices:read",
  "invoices:write",
  "vat:read",
  "vat:write",
  "journal:read",
  "journal:write",
  "approvals:read",
  "approvals:decide",
  "audit:read",
  "admin:health",
  "assistant:use",
  "excel:use",
  "files:read",
  "files:write",
  "impact:read",
  "impact:write",
  "imports:commit",
  "legislation:read",
  "news:read",
  "platform:admin",
];

interface Role {
  id: string;
  name: string;
  system: boolean;
  description: string;
  permissions: string[];
}
interface Account {
  id: string;
  email: string;
  status: "pending" | "active" | "suspended";
  roles: string[];
  createdAt: string;
}
interface Model {
  id: string;
  name: string;
  version: string;
  kind: "llm" | "embedding" | "classifier";
  artifactUri: string;
  status: "candidate" | "canary" | "production" | "retired";
  evalReport: unknown;
  createdAt: string;
}
interface Rate {
  id: string;
  taxType: string;
  code: string;
  rate: string;
  treatment: string;
  validFrom: string;
  validTo: string | null;
  legalSourceId: string | null;
  status: "proposed" | "active";
}

const seedRoles = (): Role[] => [
  {
    id: "role-admin",
    name: "admin",
    system: true,
    description: "System administrator with all permissions",
    permissions: PERMISSION_CODES,
  },
  {
    id: "role-accountant",
    name: "accountant",
    system: true,
    description: "Works with invoices, VAT and journal entries",
    permissions: [
      "invoices:read",
      "invoices:write",
      "vat:read",
      "vat:write",
      "journal:read",
      "journal:write",
      "approvals:read",
      "files:read",
      "files:write",
      "news:read",
      "legislation:read",
      "assistant:use",
      "excel:use",
    ],
  },
  {
    id: "role-approver",
    name: "approver",
    system: true,
    description: "Reviews and decides approval requests",
    permissions: ["invoices:read", "vat:read", "journal:read", "approvals:read", "approvals:decide"],
  },
  {
    id: "role-viewer",
    name: "viewer",
    system: true,
    description: "Read-only access to accounting data",
    permissions: ["invoices:read", "vat:read", "journal:read"],
  },
];
const roleOfMock: Record<MockUser["role"], string> = {
  admin: "admin",
  accountant: "accountant",
  approver: "approver",
  auditor: "viewer",
  viewer: "viewer",
};

const seedAccounts = (): Account[] =>
  Object.values(mockUsers).map((user, index) => ({
    id: user.id,
    email: user.email,
    status: "active",
    roles: [roleOfMock[user.role]],
    createdAt: new Date(Date.UTC(2026, 8, 1 + index)).toISOString(),
  }));

const seedModels = (): Model[] => [
  {
    id: "mdl-llm-1",
    name: "lexaudit-llm",
    version: "v12",
    kind: "llm",
    artifactUri: "s3://models/llm/v12",
    status: "production",
    evalReport: null,
    createdAt: "2026-09-20T09:00:00Z",
  },
  {
    id: "mdl-llm-2",
    name: "lexaudit-llm",
    version: "v13",
    kind: "llm",
    artifactUri: "s3://models/llm/v13",
    status: "candidate",
    evalReport: null,
    createdAt: "2026-10-05T09:00:00Z",
  },
  {
    id: "mdl-emb-1",
    name: "lexaudit-embed",
    version: "v2",
    kind: "embedding",
    artifactUri: "s3://models/embed/v2",
    status: "production",
    evalReport: null,
    createdAt: "2026-08-15T09:00:00Z",
  },
];

const seedRates = (): Rate[] =>
  taxRates.map((rate) => ({
    id: `rate-${rate.code}`,
    taxType: "VAT",
    code: rate.code,
    rate: (Number(rate.rate) * 100).toFixed(2),
    treatment: rate.code.includes("EXEMPT") ? "exempt" : Number(rate.rate) === 0 ? "zero_rated" : "taxable",
    validFrom: rate.validFrom,
    validTo: rate.validTo,
    legalSourceId: rate.legalSource?.id ?? null,
    status: "active",
  }));

let roles = seedRoles();
let accounts = seedAccounts();
let models = seedModels();
let rates = seedRates();
let enabled = new Map<string, boolean>();
let counter = 0;

export function resetAdmin(): void {
  roles = seedRoles();
  accounts = seedAccounts();
  models = seedModels();
  rates = seedRates();
  enabled = new Map();
  counter = 0;
}

const wireRole = (role: Role) => role;
const wireSource = (source: (typeof newsSources)[number]) => ({
  id: source.id,
  name: source.name,
  url: "https://example.org",
  type: source.kind === "official" ? "legislation" : "news",
  kind: source.kind,
  adapter: "rss",
  config: null,
  fetchCron: "0 */6 * * *",
  enabled: enabled.get(source.id) ?? true,
});
const wireRate = (rate: Rate) => ({ ...rate });

/** The public rate list: the same records as the admin list, in the shape every screen reads. */
export function publicRates(params: URLSearchParams) {
  const taxType = params.get("taxType");
  const status = params.get("status");
  return rates
    .filter((rate) => (!taxType || rate.taxType === taxType) && (!status || rate.status === status))
    .map((rate) => ({
      id: rate.id,
      taxType: rate.taxType,
      code: rate.code,
      ratePercent: rate.rate,
      treatment: rate.treatment,
      validFrom: rate.validFrom,
      validTo: rate.validTo,
      legalSourceId: rate.legalSourceId,
      status: rate.status,
    }));
}

export const adminHandlers = [
  http.get(apiPath("/admin/users"), ({ request }) => {
    const auth = authorize(request, "users:read");
    return "response" in auth ? auth.response : HttpResponse.json(accounts);
  }),

  http.post(apiPath("/admin/users"), async ({ request }) => {
    const auth = authorize(request, "users:write");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { email?: string; password?: string; roleIds?: string[] };
    const email = body.email?.trim().toLowerCase() ?? "";
    if (!/^\S+@\S+\.\S+$/.test(email) || (body.password?.length ?? 0) < 12 || !body.roleIds?.length)
      return apiError(422, "VALIDATION_FAILED", "Invalid user");
    if (body.password!.toLowerCase().includes(email.split("@")[0]!))
      return apiError(422, "VALIDATION_FAILED", "Weak password");
    if (accounts.some((account) => account.email === email))
      return apiError(409, "CONFLICT", "The e-mail is already used");
    const picked = roles.filter((role) => body.roleIds!.includes(role.id));
    if (picked.length !== body.roleIds.length) return apiError(404, "NOT_FOUND", "Role not found");
    // A person can only hand out permissions they hold themselves.
    if (picked.some((role) => role.permissions.some((code) => !auth.user.permissions.includes(code))))
      return apiError(403, "FORBIDDEN", "A role contains a permission you do not hold");
    const created: Account = {
      id: `user-new-${++counter}`,
      email,
      status: "active",
      roles: picked.map((role) => role.name),
      createdAt: new Date().toISOString(),
    };
    accounts = [...accounts, created];
    recordAudit(auth.user, {
      action: "user.create",
      resourceType: "user",
      resourceId: created.id,
      resourceLabel: email,
      outcome: "success",
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  http.patch(apiPath("/admin/users/:id"), async ({ request, params }) => {
    const auth = authorize(request, "users:write");
    if ("response" in auth) return auth.response;
    const account = accounts.find((candidate) => candidate.id === params.id);
    if (!account) return apiError(404, "NOT_FOUND", "User not found");
    const body = (await request.json()) as { status?: string };
    if (body.status !== "active" && body.status !== "suspended")
      return apiError(422, "VALIDATION_FAILED", "Invalid status");
    // Nobody may suspend themselves.
    if (account.id === auth.user.id) {
      recordAudit(auth.user, {
        action: "user.status",
        resourceType: "user",
        resourceId: account.id,
        resourceLabel: account.email,
        outcome: "denied",
      });
      return apiError(403, "FORBIDDEN", "You cannot change your own status");
    }
    account.status = body.status;
    recordAudit(auth.user, {
      action: "user.status",
      resourceType: "user",
      resourceId: account.id,
      resourceLabel: account.email,
      outcome: "success",
    });
    return HttpResponse.json(account);
  }),

  http.put(apiPath("/admin/users/:id/roles"), async ({ request, params }) => {
    const auth = authorize(request, "users:write");
    if ("response" in auth) return auth.response;
    const account = accounts.find((candidate) => candidate.id === params.id);
    if (!account) return apiError(404, "NOT_FOUND", "User not found");
    const body = (await request.json()) as { roleIds?: string[] };
    const picked = roles.filter((role) => body.roleIds?.includes(role.id));
    if (!body.roleIds?.length || picked.length !== body.roleIds.length)
      return apiError(422, "VALIDATION_FAILED", "Invalid roles");
    if (account.id === auth.user.id) return apiError(403, "FORBIDDEN", "You cannot change your own roles");
    if (picked.some((role) => role.permissions.some((code) => !auth.user.permissions.includes(code))))
      return apiError(403, "FORBIDDEN", "A role contains a permission you do not hold");
    account.roles = picked.map((role) => role.name);
    recordAudit(auth.user, {
      action: "user.roles",
      resourceType: "user",
      resourceId: account.id,
      resourceLabel: account.email,
      outcome: "success",
    });
    return HttpResponse.json(account);
  }),

  http.get(apiPath("/admin/roles"), ({ request }) => {
    const auth = authorize(request, "roles:read");
    return "response" in auth ? auth.response : HttpResponse.json(roles.map(wireRole));
  }),

  http.post(apiPath("/admin/roles"), async ({ request }) => {
    const auth = authorize(request, "roles:write");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as { name?: string; description?: string; permissions?: string[] };
    const name = body.name?.trim() ?? "";
    if (
      name.length < 2 ||
      !body.permissions?.length ||
      body.permissions.some((code) => !PERMISSION_CODES.includes(code))
    )
      return apiError(422, "VALIDATION_FAILED", "Invalid role");
    if (roles.some((role) => role.name === name)) return apiError(409, "CONFLICT", "The role already exists");
    if (body.permissions.some((code) => !auth.user.permissions.includes(code)))
      return apiError(403, "FORBIDDEN", "You can only grant permissions you hold");
    const created: Role = {
      id: `role-${++counter}`,
      name,
      system: false,
      description: body.description ?? "",
      permissions: body.permissions,
    };
    roles = [...roles, created];
    recordAudit(auth.user, {
      action: "role.create",
      resourceType: "role",
      resourceId: created.id,
      resourceLabel: name,
      outcome: "success",
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(apiPath("/admin/roles/:id/permissions"), async ({ request, params }) => {
    const auth = authorize(request, "roles:write");
    if ("response" in auth) return auth.response;
    const role = roles.find((candidate) => candidate.id === params.id);
    if (!role) return apiError(404, "NOT_FOUND", "Role not found");
    if (role.system) return apiError(403, "FORBIDDEN", "System roles cannot be changed");
    const body = (await request.json()) as { permissions?: string[] };
    if (!body.permissions || body.permissions.some((code) => !PERMISSION_CODES.includes(code)))
      return apiError(422, "VALIDATION_FAILED", "Unknown permission");
    if (body.permissions.some((code) => !auth.user.permissions.includes(code)))
      return apiError(403, "FORBIDDEN", "You can only grant permissions you hold");
    role.permissions = body.permissions;
    recordAudit(auth.user, {
      action: "role.permissions",
      resourceType: "role",
      resourceId: role.id,
      resourceLabel: role.name,
      outcome: "success",
    });
    return HttpResponse.json(role);
  }),

  http.get(apiPath("/admin/sources"), ({ request }) => {
    const auth = authorize(request, "platform:admin");
    return "response" in auth ? auth.response : HttpResponse.json(newsSources.map(wireSource));
  }),

  http.put(apiPath("/admin/sources/:id"), async ({ request, params }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    const source = newsSources.find((candidate) => candidate.id === params.id);
    if (!source) return apiError(404, "NOT_FOUND", "Source not found");
    const body = (await request.json()) as { enabled?: boolean };
    if (typeof body.enabled === "boolean") enabled.set(source.id, body.enabled);
    recordAudit(auth.user, {
      action: "source.update",
      resourceType: "source",
      resourceId: source.id,
      resourceLabel: source.name,
      outcome: "success",
    });
    return HttpResponse.json(wireSource(source));
  }),

  http.get(apiPath("/admin/alerts"), ({ request }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    return HttpResponse.json([
      {
        id: "alert-1",
        kind: "source_stale",
        sourceId: "src-dsmf",
        message: "DSMF mənbəsi 24 saatdır yenilənmir",
        createdAt: "2026-10-09T08:00:00Z",
      },
    ]);
  }),

  http.get(apiPath("/admin/tax-rates"), ({ request }) => {
    const auth = authorize(request, "platform:admin");
    return "response" in auth ? auth.response : HttpResponse.json(rates.map(wireRate));
  }),

  http.post(apiPath("/admin/tax-rates"), async ({ request }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as {
      taxType?: string;
      code?: string;
      ratePercent?: string;
      validFrom?: string;
    };
    if (
      !body.code?.trim() ||
      !/^(\d{1,2}(\.\d{1,2})?|100(\.0{1,2})?)$/.test(body.ratePercent ?? "") ||
      !/^\d{4}-\d{2}-\d{2}$/.test(body.validFrom ?? "")
    )
      return apiError(422, "VALIDATION_FAILED", "Invalid rate");
    const created: Rate = {
      id: `rate-new-${++counter}`,
      taxType: body.taxType ?? "VAT",
      code: body.code.trim(),
      rate: body.ratePercent!,
      treatment: "taxable",
      validFrom: body.validFrom!,
      validTo: null,
      legalSourceId: null,
      status: "proposed",
    };
    rates = [...rates, created];
    recordAudit(auth.user, {
      action: "tax_rate.propose",
      resourceType: "tax_rate",
      resourceId: created.id,
      resourceLabel: created.code,
      outcome: "success",
    });
    return HttpResponse.json(wireRate(created), { status: 201 });
  }),

  http.post(apiPath("/admin/tax-rates/:id/request-activation"), ({ request, params }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    const rate = rates.find((candidate) => candidate.id === params.id);
    if (!rate) return apiError(404, "NOT_FOUND", "Rate not found");
    if (rate.status !== "proposed") return apiError(409, "CONFLICT", "The rate is already active");
    const approvalId = `appr-rate-${rate.id}`;
    addApprovalRequest({
      id: approvalId,
      kind: "tax_rate_proposal",
      title: rate.code,
      summary: `${rate.rate}%`,
      riskLevel: "moderate-write",
      status: "pending",
      requestedBy: { id: auth.user.id, name: auth.user.name },
      requestedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [],
      source: { type: "tax_rate", id: rate.id } as never,
    });
    registerEffect(approvalId, {
      approved: () => void (rate.status = "active"),
      denied: () => void (rates = rates.filter((candidate) => candidate.id !== rate.id)),
    });
    recordAudit(auth.user, {
      action: "tax_rate.request_activation",
      resourceType: "tax_rate",
      resourceId: rate.id,
      resourceLabel: rate.code,
      outcome: "success",
    });
    return HttpResponse.json({ approvalId, status: "approval_required" }, { status: 202 });
  }),

  http.get(apiPath("/admin/models"), ({ request }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    return HttpResponse.json({
      versions: models,
      serving: { available: true, models: ["lexaudit-llm-v12"], error: null },
    });
  }),

  http.post(apiPath("/admin/models"), async ({ request }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    const body = (await request.json()) as {
      name?: string;
      version?: string;
      kind?: Model["kind"];
      artifactUri?: string;
    };
    if (
      !body.name?.trim() ||
      !body.version?.trim() ||
      !body.artifactUri?.trim() ||
      !body.kind ||
      !["llm", "embedding", "classifier"].includes(body.kind)
    )
      return apiError(422, "VALIDATION_FAILED", "Invalid model");
    if (models.some((model) => model.name === body.name && model.version === body.version))
      return apiError(409, "CONFLICT", "The version is already registered");
    const created: Model = {
      id: `mdl-new-${++counter}`,
      name: body.name.trim(),
      version: body.version.trim(),
      kind: body.kind,
      artifactUri: body.artifactUri.trim(),
      status: "candidate",
      evalReport: null,
      createdAt: new Date().toISOString(),
    };
    models = [...models, created];
    recordAudit(auth.user, {
      action: "model.register",
      resourceType: "model",
      resourceId: created.id,
      resourceLabel: `${created.name} ${created.version}`,
      outcome: "success",
    });
    return HttpResponse.json(created, { status: 201 });
  }),

  http.put(apiPath("/admin/models/:id/status"), async ({ request, params }) => {
    const auth = authorize(request, "platform:admin");
    if ("response" in auth) return auth.response;
    const model = models.find((candidate) => candidate.id === params.id);
    if (!model) return apiError(404, "NOT_FOUND", "Model not found");
    const body = (await request.json()) as { status?: Model["status"] };
    if (!body.status || !["candidate", "canary", "production", "retired"].includes(body.status))
      return apiError(422, "VALIDATION_FAILED", "Invalid status");
    // Only one version of a model is in production: the new one replaces the old.
    if (body.status === "production") {
      for (const other of models)
        if (other.name === model.name && other.status === "production") other.status = "retired";
    }
    model.status = body.status;
    recordAudit(auth.user, {
      action: "model.status",
      resourceType: "model",
      resourceId: model.id,
      resourceLabel: `${model.name} ${model.version}`,
      outcome: "success",
    });
    return HttpResponse.json(model);
  }),
];
