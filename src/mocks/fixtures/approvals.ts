// DEMO CONTENT. The queue, its rules (separation of duties, one decision, deadlines) belong to the backend.
import type { components } from "@/api/schema";

type ApprovalRequest = components["schemas"]["ApprovalRequest"];
type User = components["schemas"]["User"];
export type StoredApproval = Omit<ApprovalRequest, "canDecide">;

const HOUR = 3_600_000;
const inHours = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();

function seed(): StoredApproval[] {
  const accountant = { id: "user-accountant", name: "Aygün Məmmədova" };
  const chief = { id: "user-chief", name: "Elçin Həsənov" };
  const admin = { id: "user-admin", name: "Nigar Quliyeva" };
  return [
    {
      id: "appr-seed-rate",
      kind: "tax_rate_change",
      title: "Güzəştli ƏDV dərəcəsi: tikinti-quraşdırma",
      summary: "Dərəcələr cədvəlində dəyişiklik təklif olunur. Təsdiqdən sonra yeni hesablamalara tətbiq olunacaq.",
      riskLevel: "moderate-write",
      status: "pending",
      requestedBy: accountant,
      requestedAt: inHours(-5),
      expiresAt: inHours(19),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [
        { label: "Dərəcə", before: "18%", after: "0%" },
        { label: "Qüvvəyə minmə", before: null, after: "2026-11-01" },
      ],
      source: null,
    },
    {
      id: "appr-seed-access",
      kind: "access_request",
      title: "Rəşad Əliyev: qaimələrə yazma icazəsi",
      summary: "İstifadəçi qaimələri redaktə etmək üçün rolunun dəyişdirilməsini istəyir.",
      riskLevel: "low-write",
      status: "pending",
      requestedBy: admin,
      requestedAt: inHours(-30),
      expiresAt: inHours(6),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [{ label: "Rol", before: "Baxıcı", after: "Mühasib" }],
      source: null,
    },
    {
      id: "appr-seed-model",
      kind: "model_release",
      title: "Qaimə çıxarışı modeli v7",
      summary: "Yeni versiya canary mərhələsini keçib. Təsdiqdən sonra bütün şirkətlərə açılacaq.",
      riskLevel: "moderate-write",
      status: "pending",
      requestedBy: admin,
      requestedAt: inHours(-2),
      expiresAt: inHours(70),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [
        { label: "Aktiv model", before: "invoice-extractor v6", after: "invoice-extractor v7" },
        { label: "Dəqiqlik (eval)", before: "91,2%", after: "93,4%" },
        { label: "Canary", before: null, after: "5% trafik, 7 gün, xəta artımı yoxdur" },
      ],
      source: null,
    },
    {
      id: "appr-seed-done",
      kind: "access_request",
      title: "Səbinə Rzayeva: audit jurnalına giriş",
      summary: "Auditor üçün audit jurnalının oxunması.",
      riskLevel: "read",
      status: "approved",
      requestedBy: admin,
      requestedAt: inHours(-100),
      expiresAt: inHours(-76),
      decidedBy: chief,
      decidedAt: inHours(-98),
      comment: "Auditor tapşırığına uyğundur.",
      changes: [{ label: "İcazə", before: null, after: "audit:read" }],
      source: null,
    },
    {
      id: "appr-seed-expired",
      kind: "tax_rate_change",
      title: "Sadələşdirilmiş vergi dərəcəsi",
      summary: "Müddət bitdiyi üçün qərar verilməyib.",
      riskLevel: "moderate-write",
      status: "expired",
      requestedBy: accountant,
      requestedAt: inHours(-200),
      expiresAt: inHours(-150),
      decidedBy: null,
      decidedAt: null,
      comment: null,
      changes: [{ label: "Dərəcə", before: "2%", after: "3%" }],
      source: null,
    },
  ];
}

let requests = seed();

export function resetApprovals(): void {
  requests = seed();
}

export function addApprovalRequest(request: StoredApproval): void {
  requests.unshift(request);
}

export const findApproval = (id: string): StoredApproval | undefined => requests.find((item) => item.id === id);

/** What the caller sees: the same record plus a hint whether the buttons make sense for them. */
export function present(item: StoredApproval, user: User): ApprovalRequest {
  return {
    ...item,
    canDecide:
      item.status === "pending" && item.requestedBy.id !== user.id && user.permissions.includes("approvals:decide"),
  };
}

export interface ApprovalFilters {
  status?: string | null;
  kind?: string | null;
}

export function listApprovals(filters: ApprovalFilters): StoredApproval[] {
  return requests
    .filter(
      (item) => (!filters.status || item.status === filters.status) && (!filters.kind || item.kind === filters.kind),
    )
    .sort((a, b) =>
      filters.status === "pending" || (!filters.status && a.status === "pending" && b.status === "pending")
        ? a.expiresAt.localeCompare(b.expiresAt)
        : b.requestedAt.localeCompare(a.requestedAt),
    );
}

export const pendingCountFor = (user: User): number => requests.filter((item) => present(item, user).canDecide).length;

export type DecideResult =
  | { ok: true; approval: StoredApproval }
  | { ok: false; reason: "not-found" | "own-request" | "conflict" | "comment-required" };

export function decideRequest(
  id: string,
  decision: "approved" | "denied",
  comment: string | undefined,
  approver: User,
): DecideResult {
  const item = findApproval(id);
  if (!item) return { ok: false, reason: "not-found" };
  // Separation of duties: whoever asked can never be the one who approves.
  if (item.requestedBy.id === approver.id) return { ok: false, reason: "own-request" };
  // A pending request whose deadline passed is expired, whatever the stored status says.
  if (item.status === "pending" && Date.parse(item.expiresAt) < Date.now()) item.status = "expired";
  if (item.status !== "pending") return { ok: false, reason: "conflict" };
  const text = comment?.trim() ?? "";
  if (text.length < 3) return { ok: false, reason: "comment-required" };

  item.status = decision;
  item.comment = text;
  item.decidedBy = { id: approver.id, name: approver.name };
  item.decidedAt = new Date().toISOString();
  return { ok: true, approval: item };
}
