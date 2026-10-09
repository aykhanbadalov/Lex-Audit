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
