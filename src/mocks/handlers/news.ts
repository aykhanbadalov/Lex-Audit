import { delay, http, HttpResponse } from "msw";
import type { components } from "@/api/schema";
import { allNews, findNewsDetail, findNewsItem, newsSources } from "../fixtures/news";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

type NewsItem = components["schemas"]["NewsItem"];

const PERMISSION = "news:read";

// Real network has latency; tests (MODE === "test") should not wait for it.
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(250));

/** Azerbaijani-aware, case-insensitive match ("İ" and "ı" lower-case correctly with the az locale). */
function matches(haystack: string, needle: string): boolean {
  return haystack.toLocaleLowerCase("az").includes(needle.toLocaleLowerCase("az"));
}

function applyFilters(items: NewsItem[], params: URLSearchParams): NewsItem[] {
  const q = params.get("q")?.trim();
  const sourceId = params.get("sourceId");
  const category = params.get("category");
  const riskLevel = params.get("riskLevel");
  const from = params.get("publishedFrom");
  const to = params.get("publishedTo");
  const read = params.get("read") ?? "all";
  const bookmarked = params.get("bookmarked") === "true";

  return items.filter((item) => {
    const day = item.publishedAt.slice(0, 10);
    return (
      (!q || matches(`${item.title} ${item.summary} ${item.tags.join(" ")}`, q)) &&
      (!sourceId || item.sourceId === sourceId) &&
      (!category || item.category === category) &&
      (!riskLevel || item.riskLevel === riskLevel) &&
      (!from || day >= from) &&
      (!to || day <= to) &&
      (read === "all" || (read === "read" ? item.isRead : !item.isRead)) &&
      (!bookmarked || item.isBookmarked)
    );
  });
}

export const newsHandlers = [
  http.get(apiPath("/news/sources"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    return HttpResponse.json(newsSources);
  }),

  http.get(apiPath("/news"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;
    const sorted = applyFilters(allNews(), params).sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
    const items = sorted.slice(offset, offset + limit);
    const next = offset + limit;
    return HttpResponse.json({ items, nextCursor: next < sorted.length ? String(next) : null });
  }),

  http.get(apiPath("/news/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const detail = findNewsDetail(String(params.id));
    return detail ? HttpResponse.json(detail) : apiError(404, "NOT_FOUND", "News item not found");
  }),

  http.put(apiPath("/news/:id/read"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const item = findNewsItem(String(params.id));
    if (!item) return apiError(404, "NOT_FOUND", "News item not found");
    item.isRead = ((await request.json()) as { isRead: boolean }).isRead;
    return HttpResponse.json(item);
  }),

  http.put(apiPath("/news/:id/bookmark"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const item = findNewsItem(String(params.id));
    if (!item) return apiError(404, "NOT_FOUND", "News item not found");
    item.isBookmarked = ((await request.json()) as { isBookmarked: boolean }).isBookmarked;
    return HttpResponse.json(item);
  }),
];
