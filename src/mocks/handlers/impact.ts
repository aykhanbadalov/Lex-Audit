import { http, HttpResponse } from "msw";
import { allNews, findNewsDetail } from "../fixtures/news";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type Status = "new" | "seen" | "dismissed" | "actioned";
const statuses = new Map<string, Status>();

/** Findings come from the impact the sample news items carry; status changes stay in memory. */
function findings() {
  return allNews().flatMap((item) =>
    (findNewsDetail(item.id)?.impact ?? []).map((impact) => ({
      id: `imp-${item.id}-${impact.id}`,
      sourceKind: "news" as const,
      sourceId: item.id,
      affectedResourceType: impact.resourceType === "file" ? ("file" as const) : ("audit" as const),
      affectedResourceId: impact.id,
      score: String(impact.score),
      explanation: impact.explanation,
      evidence: null,
      status: statuses.get(`imp-${item.id}-${impact.id}`) ?? ("new" as const),
      createdAt: item.publishedAt,
    })),
  );
}

export const resetImpact = (): void => statuses.clear();

export const impactHandlers = [
  http.get(apiPath("/impact-findings"), ({ request }) => {
    const auth = authorize(request, "impact:read");
    if ("response" in auth) return auth.response;
    const status = new URL(request.url).searchParams.get("status");
    return HttpResponse.json(findings().filter((finding) => !status || finding.status === status));
  }),

  http.put(apiPath("/impact-findings/:id/status"), async ({ request, params }) => {
    const auth = authorize(request, "impact:write");
    if ("response" in auth) return auth.response;
    const finding = findings().find((candidate) => candidate.id === params.id);
    if (!finding) return apiError(404, "NOT_FOUND", "Finding not found");
    const status = ((await request.json()) as { status: Status }).status;
    statuses.set(finding.id, status);
    return HttpResponse.json({ ...finding, status });
  }),
];

// ---------- dashboard: notifications and the tax calendar ----------

const notificationState = new Map<string, boolean>();
export const resetNotifications = (): void => notificationState.clear();

const seedNotifications = [
  {
    id: "ntf-1",
    seq: "3",
    kind: "impact",
    title: "Yeni xəbər sənədlərinizə təsir edə bilər",
    body: "E-qaimə layihəsi ilə bağlı 1 fayl",
    refType: "news",
    refId: "11111111-1111-4111-8111-111111111111",
    createdAt: "2026-10-08T09:00:00Z",
  },
  {
    id: "ntf-2",
    seq: "2",
    kind: "source",
    title: "DSMF mənbəsi yenilənmir",
    body: "24 saatdır yeni material gəlməyib",
    refType: "source",
    refId: "22222222-2222-4222-8222-222222222222",
    createdAt: "2026-10-07T09:00:00Z",
  },
];

export const dashboardHandlers = [
  http.get(apiPath("/notifications"), ({ request }) => {
    const auth = authorize(request, "news:read");
    if ("response" in auth) return auth.response;
    const items = seedNotifications.map((item) => ({ ...item, read: notificationState.get(item.id) ?? false }));
    return HttpResponse.json({ unreadCount: items.filter((item) => !item.read).length, items });
  }),
  http.put(apiPath("/notifications/:id/read"), ({ request, params }) => {
    const auth = authorize(request, "news:read");
    if ("response" in auth) return auth.response;
    notificationState.set(String(params.id), true);
    return HttpResponse.json({ updated: 1 });
  }),
  http.post(apiPath("/notifications/read-all"), ({ request }) => {
    const auth = authorize(request, "news:read");
    if ("response" in auth) return auth.response;
    for (const item of seedNotifications) notificationState.set(item.id, true);
    return HttpResponse.json({ updated: seedNotifications.length });
  }),
  http.get(apiPath("/tax-calendar"), ({ request }) => {
    const auth = authorize(request, "vat:read");
    if ("response" in auth) return auth.response;
    return HttpResponse.json([
      { taxType: "VAT", period: "2026-09", dueDate: "2026-10-20", legalSourceId: "leg-tax-code" },
      { taxType: "SIMPLIFIED", period: "2026-Q3", dueDate: "2026-10-20", legalSourceId: null },
      { taxType: "VAT", period: "2026-10", dueDate: "2026-11-20", legalSourceId: "leg-tax-code" },
    ]);
  }),
];
