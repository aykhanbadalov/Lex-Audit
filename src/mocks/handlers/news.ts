import { delay, http, HttpResponse } from "msw";
import type { components } from "../draft/schema";
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

/** What the backend sends: AI fields are prefixed, the read/bookmark flags are short. */
function wireItem(item: NewsItem) {
  const detail = findNewsDetail(item.id);
  return {
    id: item.id,
    sourceId: item.sourceId,
    title: item.title,
    originalUrl: detail?.originalUrl ?? "https://example.org/demo-source",
    publishedAt: item.publishedAt,
    fetchedAt: detail?.fetchedAt ?? item.publishedAt,
    excerpt: item.summary,
    aiSummary: item.summary,
    aiCategory: item.category,
    aiRiskLevel: item.riskLevel,
    aiTags: item.tags,
    read: item.isRead,
    bookmarked: item.isBookmarked,
  };
}

function wireDetail(id: string) {
  const detail = findNewsDetail(id);
  if (!detail) return undefined;
  return { ...wireItem(detail), rawText: detail.body, canonicalUrl: detail.originalUrl };
}

function applyFilters(items: NewsItem[], params: URLSearchParams): NewsItem[] {
  const q = params.get("q")?.trim();
  const sourceId = params.get("sourceId");
  const unread = params.get("unread") === "true";
  const bookmarked = params.get("bookmarked") === "true";

  return items.filter(
    (item) =>
      (!q || matches(`${item.title} ${item.summary} ${item.tags.join(" ")}`, q)) &&
      (!sourceId || item.sourceId === sourceId) &&
      (!unread || !item.isRead) &&
      (!bookmarked || item.isBookmarked),
  );
}

export const newsHandlers = [
  // Open to anyone who can read the news; the platform-only list lives under /admin/sources.
  http.get(apiPath("/news/sources"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    return HttpResponse.json(
      newsSources.map((source) => ({ id: source.id, name: source.name, url: "https://example.org" })),
    );
  }),

  http.get(apiPath("/news"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;
    const sorted = applyFilters(allNews(), params).sort((x, y) => y.publishedAt.localeCompare(x.publishedAt));
    const items = sorted.slice(offset, offset + limit).map(wireItem);
    const next = offset + limit;
    return HttpResponse.json({ items, nextCursor: next < sorted.length ? String(next) : null });
  }),

  http.get(apiPath("/news/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const detail = wireDetail(String(params.id));
    return detail ? HttpResponse.json(detail) : apiError(404, "NOT_FOUND", "News item not found");
  }),

  http.put(apiPath("/news/:id/read"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const item = findNewsItem(String(params.id));
    if (!item) return apiError(404, "NOT_FOUND", "News item not found");
    item.isRead = ((await request.json()) as { value?: boolean }).value ?? true;
    return HttpResponse.json(wireItem(item));
  }),

  http.put(apiPath("/news/:id/bookmark"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    const item = findNewsItem(String(params.id));
    if (!item) return apiError(404, "NOT_FOUND", "News item not found");
    item.isBookmarked = ((await request.json()) as { value?: boolean }).value ?? true;
    return HttpResponse.json(wireItem(item));
  }),
];
