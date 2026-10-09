import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { Item, Json } from "@/api/types";
import { unwrap } from "@/api/unwrap";
import type { AuditSearch } from "./filters";

export type AuditEvent = Item<Json<"/audit-events">>;

/** The most the backend returns in one call. */
export const AUDIT_LIMIT = 200;

/** The newest events first. The backend has no filters, so searching and date ranges are applied to what it returned. */
export function useAuditEvents() {
  return useQuery({
    queryKey: ["audit", "list"],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/audit-events", { signal, params: { query: { limit: AUDIT_LIMIT } } })),
  });
}

export function filterAuditEvents(
  events: readonly AuditEvent[],
  search: AuditSearch,
  label: (event: AuditEvent) => string,
): AuditEvent[] {
  const needle = search.q?.trim().toLocaleLowerCase("az");
  return events.filter(
    (event) =>
      (!needle || label(event).toLocaleLowerCase("az").includes(needle)) &&
      (!search.from || event.createdAt.slice(0, 10) >= search.from) &&
      (!search.to || event.createdAt.slice(0, 10) <= search.to),
  );
}

const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
/** A CSV of what is on screen. Cells that start with = + - @ are prefixed so a spreadsheet never runs them as formulas. */
export function auditCsv(events: readonly AuditEvent[], actor: (id: string | null) => string): string {
  const safe = (value: string) => (/^[=+\-@]/.test(value) ? `'${value}` : value);
  const head = ["createdAt", "actor", "action", "resourceType", "resourceId", "requestId"];
  return [
    head.join(","),
    ...events.map((event) =>
      [event.createdAt, actor(event.actorId), event.action, event.resourceType, event.resourceId, event.requestId]
        .map((value) => cell(safe(value)))
        .join(","),
    ),
  ].join("\n");
}
