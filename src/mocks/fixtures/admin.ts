// DEMO CONTENT. Users, source health and model versions come from the backend and the training pipeline.
import type { components } from "@/api/schema";
import { mockUsers } from "../handlers/auth";
import { addApprovalRequest, registerEffect, type StoredApproval } from "./approvals";
import { taxRates } from "./invoices";
import { newsSources } from "./news";

type AdminUser = components["schemas"]["AdminUser"];
type AdminNewsSource = components["schemas"]["AdminNewsSource"];
type ModelVersion = components["schemas"]["ModelVersion"];
type Role = components["schemas"]["Role"];
type User = components["schemas"]["User"];

const ORIGINAL_RATES = taxRates.map((rate) => ({ code: rate.code, rate: rate.rate }));

interface UserState {
  active: boolean;
  role: Role;
  pendingRole: Role | null;
}
let users = new Map<string, UserState>();
let sourceState = new Map<string, boolean>();
let models: ModelVersion[] = [];
let counter = 0;

function seedModels(): ModelVersion[] {
  const base = { canaryPercent: null, pendingChange: null, previousScore: null };
  return [
    {
      ...base,
      id: "mdl-ext-7",
      task: "invoice_extractor",
      version: "v7",
      status: "canary",
      evalScore: "0.934",
      previousScore: "0.912",
      canaryPercent: 5,
      createdAt: "2026-10-01T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-ext-6",
      task: "invoice_extractor",
      version: "v6",
      status: "active",
      evalScore: "0.912",
      createdAt: "2026-09-01T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-ext-5",
      task: "invoice_extractor",
      version: "v5",
      status: "retired",
      evalScore: "0.897",
      createdAt: "2026-08-01T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-cls-3",
      task: "classifier",
      version: "v3",
      status: "active",
      evalScore: "0.951",
      createdAt: "2026-09-10T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-ast-12",
      task: "assistant",
      version: "v12",
      status: "active",
      evalScore: "0.883",
      createdAt: "2026-09-20T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-ast-13",
      task: "assistant",
      version: "v13",
      status: "candidate",
      evalScore: "0.871",
      previousScore: "0.883",
      createdAt: "2026-10-05T09:00:00Z",
    },
    {
      ...base,
      id: "mdl-emb-2",
      task: "embeddings",
      version: "v2",
      status: "active",
      evalScore: "0.902",
      createdAt: "2026-08-15T09:00:00Z",
    },
  ];
}

export function resetAdmin(): void {
  users = new Map(
    Object.values(mockUsers).map((user) => [user.id, { active: true, role: user.role, pendingRole: null }]),
  );
  sourceState = new Map(newsSources.map((source) => [source.id, true]));
  models = seedModels();
  counter = 0;
  for (const original of ORIGINAL_RATES) {
    const rate = taxRates.find((candidate) => candidate.code === original.code);
    if (rate) rate.rate = original.rate;
  }
}
resetAdmin();

export const listAdminUsers = (): AdminUser[] =>
  Object.values(mockUsers).map((user, index) => {
    const state = users.get(user.id)!;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: state.role,
      active: state.active,
      lastLoginAt: new Date(Date.UTC(2026, 9, 9, 8 - index, 0)).toISOString(),
      pendingRole: state.pendingRole,
    };
  });

export const findAdminUser = (id: string): User | undefined => Object.values(mockUsers).find((user) => user.id === id);

export function setActive(id: string, active: boolean): void {
  users.get(id)!.active = active;
}

const nextId = (prefix: string) => `${prefix}-${Date.now()}-${++counter}`;

function request(
  partial: Pick<StoredApproval, "kind" | "title" | "summary" | "changes">,
  by: User,
  id = nextId("appr"),
): StoredApproval {
  const created: StoredApproval = {
    ...partial,
    id,
    riskLevel: "moderate-write",
    status: "pending",
    requestedBy: { id: by.id, name: by.name },
    requestedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString(),
    decidedBy: null,
    decidedAt: null,
    comment: null,
    source: null,
  };
  addApprovalRequest(created);
  return created;
}

export function requestRoleChange(targetId: string, role: Role, by: User): StoredApproval {
  const target = findAdminUser(targetId)!;
  const state = users.get(targetId)!;
  state.pendingRole = role;
  const created = request(
    {
      kind: "access_request",
      title: `${target.name}: rol dəyişikliyi`,
      summary: "Rolun dəyişdirilməsi təsdiqdən sonra qüvvəyə minir.",
      changes: [{ label: "Rol", before: state.role, after: role }],
    },
    by,
  );
  registerEffect(created.id, {
    approved: () => void ((state.role = role), (state.pendingRole = null)),
    denied: () => void (state.pendingRole = null),
  });
  return created;
}

export function listAdminSources(): AdminNewsSource[] {
  return newsSources.map((source) => ({
    id: source.id,
    name: source.name,
    kind: source.kind,
    enabled: sourceState.get(source.id) ?? true,
    lastFetchedAt: source.lastFetchedAt ?? null,
    lastError: source.id === "src-dsmf" ? "HTTP 503 (xidmət əlçatmazdır)" : null,
    failedFetches: source.id === "src-dsmf" ? 3 : 0,
  }));
}

export const setSourceEnabled = (id: string, enabled: boolean): void => void sourceState.set(id, enabled);

export function requestRateChange(
  code: string,
  rate: string,
  validFrom: string,
  reason: string,
  by: User,
): StoredApproval | null {
  const current = taxRates.find((candidate) => candidate.code === code);
  if (!current) return null;
  const created = request(
    {
      kind: "tax_rate_change",
      title: `${current.label}: yeni dərəcə`,
      summary: reason,
      changes: [
        { label: "Dərəcə", before: current.rate, after: rate },
        { label: "Qüvvəyə minmə", before: current.validFrom, after: validFrom },
      ],
    },
    by,
  );
  registerEffect(created.id, { approved: () => void (current.rate = rate), denied: () => undefined });
  return created;
}

export const listModels = (): ModelVersion[] => models;

export function requestModelChange(id: string, action: "release" | "rollback", reason: string, by: User) {
  const model = models.find((candidate) => candidate.id === id);
  if (!model) return { error: "not-found" as const };
  if (model.pendingChange) return { error: "conflict" as const };
  if (action === "release" && model.status !== "canary" && model.status !== "candidate")
    return { error: "invalid" as const };
  if (action === "rollback" && model.status !== "retired") return { error: "invalid" as const };
  const active = models.find((candidate) => candidate.task === model.task && candidate.status === "active");
  model.pendingChange = action;
  const created = request(
    {
      kind: "model_release",
      title: `${model.task} ${model.version}: ${action === "release" ? "buraxılış" : "geri qaytarma"}`,
      summary: reason,
      changes: [
        { label: "Aktiv model", before: active?.version ?? null, after: model.version },
        { label: "Dəqiqlik (eval)", before: active?.evalScore ?? null, after: model.evalScore },
      ],
    },
    by,
  );
  registerEffect(created.id, {
    approved: () => {
      if (active) active.status = "retired";
      model.status = "active";
      model.canaryPercent = null;
      model.pendingChange = null;
    },
    denied: () => void (model.pendingChange = null),
  });
  return { approval: created };
}
