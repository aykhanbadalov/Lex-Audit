// DEMO CONTENT. Titles name real documents so the screens look realistic, but every article text below is
// invented placeholder text, and dates/numbers are placeholders. Never treat it as legal text.
import type { components } from "../draft/schema";
import { wordDiff } from "./diff";

type Summary = components["schemas"]["LegislationSummary"];
type Version = components["schemas"]["LegislationVersion"];
type Article = components["schemas"]["Article"];
type ArticleDiff = components["schemas"]["ArticleDiff"];

interface DocSeed {
  summary: Omit<Summary, "currentVersionNo" | "updatedAt">;
  /** Newest first. */
  versions: { id: string; validFrom: string; validTo: string | null; articles: Article[] }[];
}

const a = (ref: string, title: string, text: string): Article => ({ ref, title, text });

const docs: DocSeed[] = [
  {
    summary: {
      id: "leg-tax-code",
      type: "code",
      officialNumber: null,
      title: "Vergi Məcəlləsi",
      status: "in_force",
      adoptedAt: "2000-07-11",
    },
    versions: [
      {
        id: "leg-tax-code-v3",
        validFrom: "2026-01-01",
        validTo: null,
        articles: [
          a(
            "1",
            "Əsas anlayışlar",
            "Bu maddə vergi qanunvericiliyində istifadə olunan əsas anlayışları müəyyən edir. Demo mətn.",
          ),
          a(
            "2",
            "Qaimə-fakturalar",
            "ƏDV ödəyiciləri mal və xidmətlərin təqdimatı zamanı elektron qaimə-fakturanı vaxtında təqdim edir və onun doğruluğuna cavabdehdir. Demo mətn.",
          ),
          a(
            "3",
            "ƏDV depozit hesabı",
            "ƏDV ödəyiciləri ödənişləri ƏDV depozit hesabı vasitəsilə həyata keçirir və hesabın hərəkətini uçotda əks etdirir. Demo mətn.",
          ),
          a(
            "4",
            "Sadələşdirilmiş vergi",
            "Sadələşdirilmiş vergi ödəyiciləri üçün dövriyyə həddi illik əsasda qiymətləndirilir. Demo mətn.",
          ),
        ],
      },
      {
        id: "leg-tax-code-v2",
        validFrom: "2025-01-01",
        validTo: "2025-12-31",
        articles: [
          a(
            "1",
            "Əsas anlayışlar",
            "Bu maddə vergi qanunvericiliyində istifadə olunan əsas anlayışları müəyyən edir. Demo mətn.",
          ),
          a(
            "2",
            "Qaimə-fakturalar",
            "ƏDV ödəyiciləri mal və xidmətlərin təqdimatı zamanı qaimə-fakturanı təqdim edir. Demo mətn.",
          ),
          a(
            "3",
            "ƏDV depozit hesabı",
            "ƏDV ödəyiciləri ödənişləri ƏDV depozit hesabı vasitəsilə həyata keçirir. Demo mətn.",
          ),
          a(
            "4",
            "Sadələşdirilmiş vergi",
            "Sadələşdirilmiş vergi ödəyiciləri üçün dövriyyə həddi illik əsasda qiymətləndirilir. Demo mətn.",
          ),
          a("5", "Köhnə müddəa", "Bu maddə sonrakı redaksiyada çıxarılıb. Demo mətn."),
        ],
      },
      {
        id: "leg-tax-code-v1",
        validFrom: "2024-01-01",
        validTo: "2024-12-31",
        articles: [
          a("1", "Əsas anlayışlar", "Bu maddə vergi anlayışlarını müəyyən edir. Demo mətn."),
          a("2", "Qaimə-fakturalar", "ƏDV ödəyiciləri qaimə-fakturanı təqdim edir. Demo mətn."),
          a("3", "ƏDV depozit hesabı", "Ödənişlər ƏDV depozit hesabı vasitəsilə həyata keçirilir. Demo mətn."),
          a("5", "Köhnə müddəa", "Bu maddə sonrakı redaksiyada çıxarılıb. Demo mətn."),
        ],
      },
    ],
  },
  {
    summary: {
      id: "leg-accounting-law",
      type: "law",
      officialNumber: null,
      title: '"Mühasibat uçotu haqqında" Qanun',
      status: "in_force",
      adoptedAt: "2004-06-29",
    },
    versions: [
      {
        id: "leg-accounting-law-v2",
        validFrom: "2025-07-01",
        validTo: null,
        articles: [
          a(
            "1",
            "Qanunun məqsədi",
            "Qanun mühasibat uçotunun təşkili və aparılması qaydalarını müəyyən edir. Demo mətn.",
          ),
          a(
            "2",
            "Uçot sənədləri",
            "Təsərrüfat əməliyyatları ilkin uçot sənədləri ilə rəsmiləşdirilir və elektron formada saxlanıla bilər. Demo mətn.",
          ),
        ],
      },
      {
        id: "leg-accounting-law-v1",
        validFrom: "2020-01-01",
        validTo: "2025-06-30",
        articles: [
          a(
            "1",
            "Qanunun məqsədi",
            "Qanun mühasibat uçotunun təşkili və aparılması qaydalarını müəyyən edir. Demo mətn.",
          ),
          a("2", "Uçot sənədləri", "Təsərrüfat əməliyyatları ilkin uçot sənədləri ilə rəsmiləşdirilir. Demo mətn."),
        ],
      },
    ],
  },
  {
    summary: {
      id: "leg-cabinet-einvoice",
      type: "cabinet_decision",
      officialNumber: null,
      title: "Elektron qaimə-fakturaların təqdimi Qaydaları",
      status: "in_force",
      adoptedAt: "2018-03-15",
    },
    versions: [
      {
        id: "leg-cabinet-einvoice-v1",
        validFrom: "2018-03-15",
        validTo: null,
        articles: [
          a(
            "1",
            "Ümumi müddəalar",
            "Qaydalar elektron qaimə-fakturaların hazırlanması və təqdimi qaydasını müəyyən edir. Demo mətn.",
          ),
          a(
            "2",
            "Təqdim müddəti",
            "Elektron qaimə-faktura qanunvericilikdə müəyyən edilmiş müddətdə təqdim olunur. Demo mətn.",
          ),
        ],
      },
    ],
  },
  {
    summary: {
      id: "leg-mmus-fixed-assets",
      type: "standard",
      officialNumber: null,
      title: "MMUS: Əsas vəsaitlər",
      status: "in_force",
      adoptedAt: "2010-01-01",
    },
    versions: [
      {
        id: "leg-mmus-fixed-assets-v1",
        validFrom: "2010-01-01",
        validTo: null,
        articles: [
          a("1", "Tətbiq sahəsi", "Standart əsas vəsaitlərin uçotuna tətbiq olunur. Demo mətn."),
          a(
            "2",
            "Amortizasiya",
            "Əsas vəsaitlərin amortizasiyası faydalı istifadə müddəti ərzində hesablanır. Demo mətn.",
          ),
        ],
      },
    ],
  },
  {
    summary: {
      id: "leg-old-simplified",
      type: "law",
      officialNumber: null,
      title: "Köhnə sadələşdirilmiş uçot qaydaları (ləğv edilib)",
      status: "repealed",
      adoptedAt: "2005-05-05",
    },
    versions: [
      {
        id: "leg-old-simplified-v1",
        validFrom: "2005-05-05",
        validTo: "2015-12-31",
        articles: [a("1", "Ümumi müddəalar", "Bu sənəd ləğv edilib. Demo mətn.")],
      },
    ],
  },
];

function toVersion(docId: string, v: DocSeed["versions"][number], index: number, total: number): Version {
  return {
    id: v.id,
    versionNo: total - index,
    validFrom: v.validFrom,
    validTo: v.validTo,
    sourceUrl: `https://example.org/demo-legislation/${docId}`,
  };
}

export function allLegislation(): Summary[] {
  return docs.map(({ summary, versions }) => ({
    ...summary,
    currentVersionNo: versions.length,
    updatedAt: `${versions[0]?.validFrom ?? summary.adoptedAt}T00:00:00Z`,
  }));
}

export function findLegislation(id: string): (Summary & { versions: Version[] }) | undefined {
  const doc = docs.find((candidate) => candidate.summary.id === id);
  if (!doc) return undefined;
  const versions = doc.versions.map((v, index) => toVersion(id, v, index, doc.versions.length));
  return {
    ...doc.summary,
    currentVersionNo: doc.versions.length,
    updatedAt: `${doc.versions[0]?.validFrom ?? doc.summary.adoptedAt}T00:00:00Z`,
    versions,
  };
}

export function findVersionText(id: string, versionId: string): { version: Version; articles: Article[] } | undefined {
  const doc = docs.find((candidate) => candidate.summary.id === id);
  const index = doc?.versions.findIndex((v) => v.id === versionId) ?? -1;
  if (!doc || index < 0) return undefined;
  return {
    version: toVersion(id, doc.versions[index]!, index, doc.versions.length),
    articles: doc.versions[index]!.articles,
  };
}

export function diffVersions(
  id: string,
  fromId: string,
  toId: string,
): { from: Version; to: Version; articles: ArticleDiff[] } | undefined {
  const from = findVersionText(id, fromId);
  const to = findVersionText(id, toId);
  if (!from || !to) return undefined;

  const refs = [...new Set([...from.articles.map((x) => x.ref), ...to.articles.map((x) => x.ref)])].sort((x, y) =>
    x.localeCompare(y, undefined, { numeric: true }),
  );

  const articles = refs.map((ref): ArticleDiff => {
    const before = from.articles.find((x) => x.ref === ref);
    const after = to.articles.find((x) => x.ref === ref);
    const title = (after ?? before)?.title ?? ref;
    if (!before && after) return { ref, title, status: "added", segments: [{ type: "added", text: after.text }] };
    if (before && !after) return { ref, title, status: "removed", segments: [{ type: "removed", text: before.text }] };
    const segments = wordDiff(before!.text, after!.text);
    const changed = segments.some((segment) => segment.type !== "equal");
    return { ref, title, status: changed ? "changed" : "unchanged", segments };
  });

  return { from: from.version, to: to.version, articles };
}
