import { delay, http, HttpResponse } from "msw";
import { allLegislation, diffVersions, findLegislation, findVersionText } from "../fixtures/legislation";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const PERMISSION = "legislation:read";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(250));

export const legislationHandlers = [
  http.get(apiPath("/legislation"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim().toLocaleLowerCase("az");
    const type = params.get("type");
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("cursor") ?? 0) || 0;

    const filtered = allLegislation()
      .filter((doc) => (!type || doc.type === type) && (!q || doc.title.toLocaleLowerCase("az").includes(q)))
      .sort((x, y) => x.title.localeCompare(y.title, "az"));
    const next = offset + limit;
    return HttpResponse.json({
      items: filtered.slice(offset, next),
      nextCursor: next < filtered.length ? String(next) : null,
    });
  }),

  http.get(apiPath("/legislation/:id/diff"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const search = new URL(request.url).searchParams;
    const result = diffVersions(String(params.id), search.get("from") ?? "", search.get("to") ?? "");
    return result ? HttpResponse.json(result) : apiError(404, "NOT_FOUND", "Version not found");
  }),

  http.get(apiPath("/legislation/:id/versions/:versionId"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const result = findVersionText(String(params.id), String(params.versionId));
    return result ? HttpResponse.json(result) : apiError(404, "NOT_FOUND", "Version not found");
  }),

  http.get(apiPath("/legislation/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const doc = findLegislation(String(params.id));
    return doc ? HttpResponse.json(doc) : apiError(404, "NOT_FOUND", "Document not found");
  }),
];
