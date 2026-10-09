import { delay, http, HttpResponse } from "msw";
import { allLegislation, diffVersions, findLegislation, findVersionText } from "../fixtures/legislation";
import { apiError, authorize } from "./auth";
import { apiPath } from "./base";

const PERMISSION = "legislation:read";
const latency = () => (import.meta.env.MODE === "test" ? Promise.resolve() : delay(250));

type Doc = NonNullable<ReturnType<typeof findLegislation>>;
type Version = Doc["versions"][number];

function wireSummary(doc: ReturnType<typeof allLegislation>[number]) {
  return {
    id: doc.id,
    type: doc.type,
    officialNumber: doc.officialNumber ?? "",
    adoptedAt: doc.adoptedAt,
    title: doc.title,
    language: "az",
    sourceUrl: `https://example.org/demo-legislation/${doc.id}`,
    latestVersionNo: doc.currentVersionNo,
    currentValidFrom: doc.updatedAt.slice(0, 10),
  };
}

const wireVersion = (version: Version) => ({
  versionNo: version.versionNo,
  validFrom: version.validFrom,
  validTo: version.validTo ?? "",
  contentHash: `sha256-${version.id}`,
  sourceUrl: version.sourceUrl,
});

/** The backend asks for text by the day it was in force ("date"); the newest version when omitted. */
function versionOn(doc: Doc, date: string | null): Version {
  if (!date) return doc.versions[0]!;
  return (
    doc.versions.find((v) => v.validFrom <= date && (!v.validTo || v.validTo >= date)) ??
    doc.versions[doc.versions.length - 1]!
  );
}

export const legislationHandlers = [
  http.get(apiPath("/legislation"), async ({ request }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();

    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim().toLocaleLowerCase("az");
    const type = params.get("type");
    const limit = Math.min(Number(params.get("limit") ?? 20) || 20, 100);
    const offset = Number(params.get("offset") ?? 0) || 0;

    const filtered = allLegislation()
      .filter((doc) => (!type || doc.type === type) && (!q || doc.title.toLocaleLowerCase("az").includes(q)))
      .sort((x, y) => x.title.localeCompare(y.title, "az"));
    return HttpResponse.json(filtered.slice(offset, offset + limit).map(wireSummary));
  }),

  http.get(apiPath("/legislation/:id/versions"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const doc = findLegislation(String(params.id));
    return doc ? HttpResponse.json(doc.versions.map(wireVersion)) : apiError(404, "NOT_FOUND", "Document not found");
  }),

  http.get(apiPath("/legislation/:id/diff"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const doc = findLegislation(String(params.id));
    const search = new URL(request.url).searchParams;
    const byNo = (value: string | null) => doc?.versions.find((v) => v.versionNo === Number(value));
    const from = byNo(search.get("from"));
    const to = byNo(search.get("to"));
    if (!doc || !from || !to) return apiError(404, "NOT_FOUND", "Version not found");
    const result = diffVersions(doc.id, from.id, to.id);
    if (!result) return apiError(404, "NOT_FOUND", "Version not found");

    // The backend compares paragraph by paragraph; the sample data is compared by article, then flattened to the same shape.
    const hunks: { type: "added" | "removed" | "unchanged"; text: string }[] = [];
    for (const article of result.articles) {
      if (article.status === "unchanged") {
        hunks.push({ type: "unchanged", text: article.segments.map((segment) => segment.text).join("") });
        continue;
      }
      for (const segment of article.segments) {
        const type = segment.type === "equal" ? "unchanged" : segment.type;
        const last = hunks[hunks.length - 1];
        if (last && last.type === type) last.text += segment.text;
        else hunks.push({ type, text: segment.text });
      }
    }
    return HttpResponse.json({ from: wireVersion(from), to: wireVersion(to), hunks });
  }),

  http.get(apiPath("/legislation/:id"), async ({ request, params }) => {
    const auth = authorize(request, PERMISSION);
    if ("response" in auth) return auth.response;
    await latency();
    const doc = findLegislation(String(params.id));
    if (!doc) return apiError(404, "NOT_FOUND", "Document not found");
    const version = versionOn(doc, new URL(request.url).searchParams.get("date"));
    const text = findVersionText(doc.id, version.id)!;
    return HttpResponse.json({
      ...wireSummary(allLegislation().find((candidate) => candidate.id === doc.id)!),
      version: {
        ...wireVersion(version),
        fullText: text.articles.map((article) => `${article.ref}. ${article.title}\n${article.text}`).join("\n\n"),
      },
    });
  }),
];
