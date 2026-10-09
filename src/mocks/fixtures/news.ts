// DEMO CONTENT. These items are invented to exercise the UI; they are not real announcements or legal text.
import type { components } from "../draft/schema";

type NewsSource = components["schemas"]["NewsSource"];
type NewsItem = components["schemas"]["NewsItem"];
type NewsDetail = components["schemas"]["NewsDetail"];

export const newsSources: NewsSource[] = [
  { id: "src-eqanun", name: "e-qanun.az", kind: "official", lastFetchedAt: "2026-10-09T06:00:00Z" },
  { id: "src-taxes", name: "Dövlət Vergi Xidməti", kind: "official", lastFetchedAt: "2026-10-09T06:05:00Z" },
  { id: "src-maliyye", name: "Maliyyə Nazirliyi", kind: "official", lastFetchedAt: "2026-10-08T18:00:00Z" },
  { id: "src-cbar", name: "Azərbaycan Mərkəzi Bankı", kind: "official", lastFetchedAt: "2026-10-09T07:00:00Z" },
  { id: "src-dsmf", name: "DSMF", kind: "official", lastFetchedAt: "2026-10-08T12:00:00Z" },
  { id: "src-portal", name: "Biznes xəbər portalı (demo)", kind: "news", lastFetchedAt: "2026-10-09T05:30:00Z" },
];

interface Seed {
  id: string;
  sourceId: string;
  title: string;
  category: NewsItem["category"];
  riskLevel: NewsItem["riskLevel"];
  publishedAt: string;
  tags: string[];
  paragraphs: string[];
  summary: string;
  riskExplanation: string;
  related?: NewsDetail["relatedLegislation"];
  impact?: NewsDetail["impact"];
  read?: boolean;
  bookmarked?: boolean;
}

const seeds: Seed[] = [
  {
    id: "news-einvoice-bill",
    sourceId: "src-eqanun",
    title: "Vergi Məcəlləsinə dəyişiklik layihəsi: elektron qaimə-fakturaların təqdimi qaydası dəqiqləşdirilir",
    category: "tax",
    riskLevel: "high",
    publishedAt: "2026-10-09T05:40:00Z",
    tags: ["e-qaimə", "Vergi Məcəlləsi", "layihə"],
    paragraphs: [
      "Layihədə elektron qaimə-fakturaların təqdim edilməsi qaydasına dair əlavə tələblər nəzərdə tutulur.",
      "Layihə ictimai müzakirəyə çıxarılıb. Qəbul olunduqdan sonra ƏDV ödəyiciləri öz daxili proseslərini yeni tələblərə uyğunlaşdırmalı olacaq.",
    ],
    summary: "Elektron qaimə-fakturaların təqdimi qaydası dəqiqləşdirilir; layihə hələ müzakirə mərhələsindədir.",
    riskExplanation:
      "ƏDV ödəyiciləri üçün qaimə-faktura proseslərinə təsir edə bilər. Layihə qəbul olunmayıb, lakin hazırlıq tövsiyə olunur.",
    related: [
      { id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: "2" },
      { id: "leg-cabinet-einvoice", title: "Elektron qaimə-fakturaların təqdimi Qaydaları", articleRef: null },
    ],
    impact: [
      {
        id: "imp-1",
        resourceType: "file",
        resourceTitle: "ƏDV prosedurları (daxili təlimat).pdf",
        score: 0.82,
        explanation: "Təlimatın 3-cü bölməsi qaimə-fakturaların təqdim qaydasını təsvir edir və yenilənməli ola bilər.",
      },
      {
        id: "imp-2",
        resourceType: "audit_finding",
        resourceTitle: "2025 daxili audit: gecikmiş qaimə-fakturalar",
        score: 0.64,
        explanation: "Keçmiş tapıntı eyni prosesə aiddir; yeni tələblər riski artıra bilər.",
      },
    ],
  },
  {
    id: "news-vat-deposit-clarification",
    sourceId: "src-taxes",
    title: "ƏDV depozit hesabı üzrə izahat dərc olunub",
    category: "vat",
    riskLevel: "medium",
    publishedAt: "2026-10-08T14:20:00Z",
    tags: ["ƏDV", "depozit hesabı", "izahat"],
    paragraphs: [
      "İzahatda ƏDV depozit hesabından istifadə qaydaları barədə tez-tez verilən suallar cavablandırılır.",
      "Sənəd vergi ödəyicilərinə ödənişlərin uçotu ilə bağlı praktik məsələləri aydınlaşdırmaq məqsədi daşıyır.",
    ],
    summary: "Vergi xidməti ƏDV depozit hesabı üzrə praktik sualları izah edən sənəd dərc edib.",
    riskExplanation:
      "Depozit hesabı ilə uçot arasında uzlaşdırma aparan şirkətlər üçün faydalıdır; birbaşa cərimə riski yoxdur.",
    related: [{ id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: "3" }],
    impact: [
      {
        id: "imp-3",
        resourceType: "record",
        resourceTitle: "ƏDV depozit hesabı uzlaşdırması (sentyabr)",
        score: 0.71,
        explanation: "Aylıq uzlaşdırma qaydası izahatla müqayisə olunmalıdır.",
      },
    ],
    bookmarked: true,
  },
  {
    id: "news-sme-tax-limit",
    sourceId: "src-eqanun",
    title: "Sadələşdirilmiş vergi rejimində limitlərin dəyişdirilməsi təklif olunur",
    category: "tax",
    riskLevel: "critical",
    publishedAt: "2026-10-07T09:10:00Z",
    tags: ["sadələşdirilmiş vergi", "limit", "layihə"],
    paragraphs: [
      "Təklif olunan dəyişiklik sadələşdirilmiş vergi ödəyicilərinin dövriyyə limitlərinə təsir göstərə bilər.",
      "Limiti aşan təşkilatlar ümumi vergi rejiminə keçməli olacaq.",
    ],
    summary: "Sadələşdirilmiş vergi limitlərinin dəyişməsi təklif olunur; limiti aşanlar ümumi rejimə keçə bilər.",
    riskExplanation:
      "Rejim dəyişikliyi uçot və hesabatlılıq yükünü əhəmiyyətli dərəcədə artırır. Müştəri siyahısı üzrə dövriyyə yoxlanmalıdır.",
    related: [{ id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: "4" }],
    impact: [
      {
        id: "imp-4",
        resourceType: "record",
        resourceTitle: "Müştəri dövriyyəsi icmalı (Q3)",
        score: 0.9,
        explanation: "Bir neçə müştərinin dövriyyəsi təklif olunan həddə yaxındır.",
      },
    ],
  },
  {
    id: "news-dsmf-contribution",
    sourceId: "src-dsmf",
    title: "DSMF: sığorta haqlarının hesablanması üzrə yeni izahlar",
    category: "labor",
    riskLevel: "high",
    publishedAt: "2026-10-06T11:00:00Z",
    tags: ["DSMF", "əmək haqqı", "sığorta haqqı"],
    paragraphs: [
      "Fond işəgötürənlər üçün sığorta haqlarının hesablanması qaydalarına dair izahlar dərc edib.",
      "İzahlar xüsusilə ödənişlərin hansı hissəsinin bazaya daxil olunması məsələsinə toxunur.",
    ],
    summary: "DSMF sığorta haqqı bazasının müəyyən edilməsi ilə bağlı yeni izahlar yayımlayıb.",
    riskExplanation:
      "Əmək haqqı hesablamalarında səhv yanlış haqq hesablanmasına və gecikmə faizlərinə səbəb ola bilər.",
    related: [{ id: "leg-accounting-law", title: '"Mühasibat uçotu haqqında" Qanun', articleRef: null }],
    read: true,
  },
  {
    id: "news-accounting-standards-draft",
    sourceId: "src-maliyye",
    title: "Əsas vəsaitlərin uçotu üzrə standart layihəsi ictimai müzakirədədir",
    category: "accounting",
    riskLevel: "medium",
    publishedAt: "2026-10-05T08:30:00Z",
    tags: ["MMUS", "əsas vəsaitlər", "amortizasiya"],
    paragraphs: [
      "Standart layihəsi əsas vəsaitlərin ilkin tanınması və sonrakı ölçülməsi qaydalarını yeniləyir.",
      "Rəylər müəyyən müddət ərzində qəbul edilir.",
    ],
    summary: "Əsas vəsaitlərin uçotu üzrə yenilənmiş standart layihəsi rəy üçün açıqdır.",
    riskExplanation: "Amortizasiya metodlarına təsir edə bilər. Hələlik məcburi deyil.",
    related: [{ id: "leg-mmus-fixed-assets", title: "MMUS: Əsas vəsaitlər", articleRef: null }],
  },
  {
    id: "news-cbar-fx",
    sourceId: "src-cbar",
    title: "Mərkəzi Bank rəsmi məzənnələrin yayımlanma qaydasını xatırladır",
    category: "banking",
    riskLevel: "low",
    publishedAt: "2026-10-04T07:00:00Z",
    tags: ["məzənnə", "CBAR"],
    paragraphs: ["Rəsmi məzənnələr hər iş günü yayımlanır və valyuta əməliyyatlarının uçotunda əsas götürülür."],
    summary: "Rəsmi məzənnələr valyuta əməliyyatlarının AZN-ə çevrilməsi üçün əsasdır; qayda dəyişməyib.",
    riskExplanation: "Əməli dəyişiklik yoxdur, məlumat xarakterlidir.",
    read: true,
  },
  {
    id: "news-customs-electronic",
    sourceId: "src-taxes",
    title: "Gömrük bəyannamələrinin elektron təqdimi üzrə texniki göstərişlər yenilənib",
    category: "customs",
    riskLevel: "medium",
    publishedAt: "2026-10-03T13:45:00Z",
    tags: ["gömrük", "elektron bəyannamə"],
    paragraphs: ["Texniki göstərişlərdə fayl formatları və doğrulama qaydaları dəqiqləşdirilib."],
    summary: "Elektron gömrük bəyannamələri üçün fayl formatı və doğrulama qaydaları yenilənib.",
    riskExplanation: "İdxal-ixrac edən müştərilərin bəyannamə proqramı yenilənməli ola bilər.",
  },
  {
    id: "news-filing-deadline",
    sourceId: "src-taxes",
    title: "Rüblük bəyannamələrin təqdimi müddəti xatırladılır",
    category: "tax",
    riskLevel: "medium",
    publishedAt: "2026-10-02T09:00:00Z",
    tags: ["bəyannamə", "müddət"],
    paragraphs: ["Vergi ödəyiciləri rüblük bəyannamələri qanunvericiliklə müəyyən olunmuş müddətdə təqdim etməlidir."],
    summary: "Vergi xidməti rüblük bəyannamələrin vaxtında təqdim edilməsini xatırladır.",
    riskExplanation: "Gecikmə cərimə ilə nəticələnə bilər. Müştəri bəyannamələrinin vəziyyətini yoxlayın.",
    bookmarked: true,
  },
  {
    id: "news-ifrs-guidance",
    sourceId: "src-maliyye",
    title: "MHBS tətbiqi üzrə metodiki izahlar yenilənib",
    category: "accounting",
    riskLevel: "low",
    publishedAt: "2026-09-30T10:15:00Z",
    tags: ["MHBS", "metodiki izah"],
    paragraphs: ["Metodiki izahlar maliyyə hesabatlarının hazırlanmasında yaranan ümumi suallara cavab verir."],
    summary: "MHBS üzrə yenilənmiş metodiki izahlar hesabat hazırlayan şirkətlər üçün faydalıdır.",
    riskExplanation: "Məcburi dəyişiklik yoxdur.",
    read: true,
  },
  {
    id: "news-employer-report-form",
    sourceId: "src-dsmf",
    title: "İşəgötürənlər üçün hesabat formasında dəyişiklik",
    category: "labor",
    riskLevel: "medium",
    publishedAt: "2026-09-28T12:30:00Z",
    tags: ["hesabat", "işəgötürən"],
    paragraphs: ["İşəgötürənlərin təqdim etdiyi hesabat formasına yeni sahələr əlavə olunub."],
    summary: "İşəgötürən hesabat formasına yeni sahələr əlavə edilib.",
    riskExplanation: "Köhnə forma ilə təqdim edilən hesabatlar qəbul olunmaya bilər.",
  },
  {
    id: "news-cashless-payments",
    sourceId: "src-cbar",
    title: "Nağdsız ödənişlərin təşviqi ilə bağlı yeni tövsiyələr",
    category: "banking",
    riskLevel: "medium",
    publishedAt: "2026-09-25T08:00:00Z",
    tags: ["nağdsız ödəniş", "bank"],
    paragraphs: ["Tövsiyələr kommersiya təşkilatlarının ödəniş proseslərini nağdsız formata keçirməsinə yönəlib."],
    summary: "Mərkəzi Bank təşkilatlara nağdsız ödənişlərə keçid üzrə tövsiyələr verib.",
    riskExplanation: "Məcburi deyil, lakin bank uzlaşdırma proseslərinə təsir edə bilər.",
  },
  {
    id: "news-portal-digest",
    sourceId: "src-portal",
    title: "Mühasiblər üçün həftənin yenilikləri icmalı",
    category: "other",
    riskLevel: "low",
    publishedAt: "2026-09-22T16:00:00Z",
    tags: ["icmal"],
    paragraphs: ["İcmalda son həftənin əsas vergi və uçot xəbərləri qısa şəkildə təqdim olunur."],
    summary: "Həftənin vergi və uçot xəbərlərinin qısa icmalı.",
    riskExplanation: "Məlumat xarakterlidir.",
  },
  {
    id: "news-demo-vat-close",
    sourceId: "src-taxes",
    title: "DEMO: Sentyabr ƏDV uzlaşdırmasında yoxlama ssenarisi",
    category: "vat",
    riskLevel: "medium",
    publishedAt: "2026-10-08T16:05:00Z",
    tags: ["DEMO", "ƏDV", "uzlaşdırma"],
    paragraphs: [
      "Bu, Lex-Audit təqdimatı üçün hazırlanmış uydurma ssenaridir; rəsmi açıqlama deyil.",
      "Ssenaridə depozit hesabı hərəkətlərinin sentyabr dövrünün satış və alış qaimələri ilə tutuşdurulması göstərilir.",
    ],
    summary: "DEMO ssenarisi: bir depozit hesabı sətri qaimə ilə avtomatik uyğunlaşmır.",
    riskExplanation: "Nümunə əməliyyatın tarix və məbləğini ilkin sənədlərlə yoxlamaq üçün nəzərdə tutulub.",
    related: [{ id: "leg-tax-code", title: "Vergi Məcəlləsi", articleRef: "3" }],
    impact: [
      {
        id: "imp-demo-vat-1",
        resourceType: "record",
        resourceTitle: "ƏDV dövrü 2026-09",
        score: 0.78,
        explanation: "Demo uzlaşdırma sətri sentyabr ƏDV dövrü ilə əlaqələndirilib.",
      },
    ],
  },
  {
    id: "news-demo-payroll-review",
    sourceId: "src-dsmf",
    title: "DEMO: Əmək haqqı hesabatında yoxlama ssenarisi",
    category: "labor",
    riskLevel: "high",
    publishedAt: "2026-10-08T13:30:00Z",
    tags: ["DEMO", "əmək haqqı", "hesabat"],
    paragraphs: [
      "Bu material yalnız demo ssenarisidir və DSMF-nin real xəbəri və ya rəsmi hüquqi izahı deyil.",
      "Nümunədə əmək haqqı cədvəlindəki sosial sığorta bazası ilə hesabat xanası arasında fərq göstərilir.",
    ],
    summary: "DEMO ssenarisi: əmək haqqı cədvəli ilə hesabat göstəricisi tutuşdurulur.",
    riskExplanation: "Məbləği təsdiqləməzdən əvvəl əmək haqqı hesablamasını və ilkin cədvəli yoxlayın.",
    related: [{ id: "leg-accounting-law", title: '"Mühasibat uçotu haqqında" Qanun', articleRef: "2" }],
    impact: [
      {
        id: "imp-demo-payroll-1",
        resourceType: "file",
        resourceTitle: "Əmək haqqı cədvəli.xlsx",
        score: 0.86,
        explanation: "Demo ssenarisi mövcud əmək haqqı faylına bağlanıb.",
      },
    ],
  },
];

function toItem(seed: Seed): NewsItem {
  const source = newsSources.find((candidate) => candidate.id === seed.sourceId);
  return {
    id: seed.id,
    sourceId: seed.sourceId,
    sourceName: source?.name ?? seed.sourceId,
    title: seed.title,
    category: seed.category,
    riskLevel: seed.riskLevel,
    publishedAt: seed.publishedAt,
    summary: seed.summary,
    tags: seed.tags,
    isRead: seed.read ?? false,
    isBookmarked: seed.bookmarked ?? false,
  };
}

function toDetail(seed: Seed, item: NewsItem): NewsDetail {
  return {
    ...item,
    body: seed.paragraphs.join("\n\n"),
    originalUrl: "https://example.org/demo-source",
    fetchedAt: seed.publishedAt,
    lastCheckedAt: "2026-10-09T07:30:00Z",
    ai: {
      summary: seed.summary,
      riskExplanation: seed.riskExplanation,
      modelVersion: "lexaudit-llm-demo-0.1",
      generatedAt: seed.publishedAt,
    },
    relatedLegislation: seed.related ?? [],
    impact: seed.impact ?? [],
  };
}

/** Mutable copy so read/bookmark changes survive between requests. Tests call resetNewsDb(). */
let items: NewsItem[] = seeds.map(toItem);

export function resetNewsDb(): void {
  items = seeds.map(toItem);
}

export function allNews(): NewsItem[] {
  return items;
}

export function findNewsItem(id: string): NewsItem | undefined {
  return items.find((item) => item.id === id);
}

export function findNewsDetail(id: string): NewsDetail | undefined {
  const seed = seeds.find((candidate) => candidate.id === id);
  const item = findNewsItem(id);
  return seed && item ? toDetail(seed, item) : undefined;
}
