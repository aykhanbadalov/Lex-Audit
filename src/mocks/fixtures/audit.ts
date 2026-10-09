// DEMO CONTENT. The real log is written by the backend for every action; nothing here can be changed through the API.
import type { components } from "../draft/schema";

type AuditEvent = components["schemas"]["AuditEvent"];
import type { MockUser as User } from "../handlers/auth";

const PEOPLE = [
  { id: "user-accountant", name: "Aygün Məmmədova" },
  { id: "user-chief", name: "Elçin Həsənov" },
  { id: "user-admin", name: "Nigar Quliyeva" },
  { id: "user-auditor", name: "Səbinə Rzayeva" },
];

const TEMPLATES: Pick<AuditEvent, "action" | "resourceType" | "resourceLabel" | "outcome">[] = [
  { action: "auth.login", resourceType: "session", resourceLabel: "Sistemə giriş", outcome: "success" },
  { action: "invoice.upload", resourceType: "invoice", resourceLabel: "Qaimə AF-0457", outcome: "success" },
  { action: "invoice.update", resourceType: "invoice", resourceLabel: "Qaimə AF-0458", outcome: "success" },
  {
    action: "journal.submit",
    resourceType: "journal_entry",
    resourceLabel: "Jurnal yazılışı je-seed-2",
    outcome: "success",
  },
  {
    action: "vat.declaration_draft",
    resourceType: "vat_period",
    resourceLabel: "ƏDV dövrü 2026-09",
    outcome: "success",
  },
  { action: "file.archive", resourceType: "file", resourceLabel: "Bank çıxarışı sentyabr.xlsx", outcome: "success" },
  { action: "invoice.update", resourceType: "invoice", resourceLabel: "Qaimə BT-118", outcome: "denied" },
  { action: "import.commit", resourceType: "import", resourceLabel: "1C idxalı", outcome: "failed" },
  { action: "assistant.message", resourceType: "conversation", resourceLabel: "ƏDV sualları", outcome: "success" },
];

const NEWEST = Date.parse("2026-10-08T12:00:00Z");

function seed(): AuditEvent[] {
  return Array.from({ length: 60 }, (_, index) => {
    const template = TEMPLATES[(index * 7) % TEMPLATES.length]!;
    const person = PEOPLE[(index * 5) % PEOPLE.length]!;
    return {
      ...template,
      id: `aud-seed-${String(index + 1).padStart(3, "0")}`,
      at: new Date(NEWEST - index * 37 * 60_000).toISOString(),
      actor: person,
      resourceId: `${template.resourceType}-${index + 1}`,
      ip: `10.0.0.${10 + (index % 5)}`,
      requestId: `req-seed-${index + 1}`,
    };
  });
}

let events = seed();
let counter = 0;

export function resetAudit(): void {
  events = seed();
  counter = 0;
}

export interface AuditFilters {
  q?: string | null;
  action?: string | null;
  resourceType?: string | null;
  outcome?: string | null;
  from?: string | null;
  to?: string | null;
}

export function recordAudit(
  actor: Pick<User, "id" | "name">,
  event: Pick<AuditEvent, "action" | "resourceType" | "resourceId" | "resourceLabel" | "outcome">,
): void {
  events.unshift({
    ...event,
    id: `aud-${++counter}`,
    at: new Date().toISOString(),
    actor: { id: actor.id, name: actor.name },
    ip: "10.0.0.99",
    requestId: `req-${counter}`,
  });
}

export function queryAudit(filters: AuditFilters): AuditEvent[] {
  const q = filters.q?.trim().toLocaleLowerCase("az");
  return events
    .filter(
      (event) =>
        (!q || `${event.actor.name} ${event.action} ${event.resourceLabel}`.toLocaleLowerCase("az").includes(q)) &&
        (!filters.action || event.action === filters.action) &&
        (!filters.resourceType || event.resourceType === filters.resourceType) &&
        (!filters.outcome || event.outcome === filters.outcome) &&
        (!filters.from || event.at.slice(0, 10) >= filters.from) &&
        (!filters.to || event.at.slice(0, 10) <= filters.to),
    )
    .sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id));
}

export function auditCsv(rows: AuditEvent[]): string {
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  const head = ["at", "actor", "action", "resourceType", "resourceLabel", "outcome", "requestId"];
  return [
    head.join(","),
    ...rows.map((row) =>
      [row.at, row.actor.name, row.action, row.resourceType, row.resourceLabel, row.outcome, row.requestId]
        .map(cell)
        .join(","),
    ),
  ].join("\n");
}
