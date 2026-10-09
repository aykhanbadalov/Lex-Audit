import { describe, expect, it } from "vitest";
import { auditCsv, filterAuditEvents, type AuditEvent } from "./api";

const event = (patch: Partial<AuditEvent>): AuditEvent => ({
  id: "1",
  actorId: "u1",
  action: "invoice.update",
  resourceType: "invoice",
  resourceId: "inv-1",
  before: null,
  after: null,
  requestId: "r1",
  createdAt: "2026-10-08T10:00:00Z",
  ...patch,
});

describe("filterAuditEvents", () => {
  const events = [event({ id: "a" }), event({ id: "b", action: "file.upload", createdAt: "2026-09-01T10:00:00Z" })];
  const label = (e: AuditEvent) => `${e.action} ${e.resourceType} ${e.resourceId}`;

  it("matches the text in the action, the resource type and the resource id", () => {
    expect(filterAuditEvents(events, { q: "UPLOAD" }, label).map((e) => e.id)).toEqual(["b"]);
    expect(filterAuditEvents(events, { q: "inv-1" }, label).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("keeps both ends of the date range", () => {
    expect(filterAuditEvents(events, { from: "2026-10-08", to: "2026-10-08" }, label).map((e) => e.id)).toEqual(["a"]);
  });
});

describe("auditCsv", () => {
  it("quotes cells and defuses spreadsheet formulas", () => {
    const csv = auditCsv([event({ resourceId: '=HYPERLINK("x")' })], () => "Aygün");
    expect(csv.split("\n")[1]).toContain(`"'=HYPERLINK(""x"")"`);
  });
});
