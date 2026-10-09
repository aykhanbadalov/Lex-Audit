// DEMO CONTENT. Illustrative values only; this snapshot stays in the frontend demo layer.
export const dashboardSnapshot = {
  metrics: [
    { key: "invoices", value: "24", detail: "18 yoxlanıb · 3 diqqət tələb edir", href: "/invoices" },
    { key: "vat", value: "₼ 18 420,50", detail: "2026-cı ilin sentyabr dövrü", href: "/vat" },
    { key: "reconciliation", value: "5 / 8", detail: "3 uyğunluq araşdırılır", href: "/reconciliation" },
    { key: "files", value: "2", detail: "Emal və yoxlama gözləyir", href: "/files" },
  ],
  activity: [
    {
      id: "invoice",
      title: "BT-118 qaiməsində məbləğ fərqi aşkarlandı",
      detail: "Beta ASC · ₼20,00 fərq",
      at: "09:42",
      href: "/invoices/inv-1002",
      tone: "warning",
    },
    {
      id: "reconciliation",
      title: "Bank uzlaşdırması tamamlandı",
      detail: "Avqust çıxarışı · 5 uyğun, 2 yoxlanmalı",
      at: "09:18",
      href: "/reconciliation",
      tone: "success",
    },
    {
      id: "file",
      title: "Sənəd emalı başa çatdı",
      detail: "alfa-təkrar.pdf · dublikat ehtimalı",
      at: "Dünən",
      href: "/files",
      tone: "info",
    },
  ],
  approvals: [
    { id: "appr-seed-rate", title: "Güzəştli ƏDV dərəcəsi təklifi", detail: "Aygün Məmmədova · 19 saat qalır" },
    { id: "appr-demo-import", title: "Sentyabr qaimə idxalı", detail: "Maliyyə komandası · yoxlama gözləyir" },
  ],
  risks: [
    {
      id: "invoice-mismatch",
      title: "Qaimədə məbləğ uyğunsuzluğu",
      detail: "BT-118: bəyan edilən cəm hesablanmış cəmdən ₼20,00 fərqlənir.",
      level: "high",
      href: "/invoices/inv-1002",
    },
    {
      id: "duplicate",
      title: "Mümkün təkrar qaimə",
      detail: "AF-0457 nömrəsi iki sənəddə göründü.",
      level: "medium",
      href: "/invoices",
    },
    {
      id: "reconciliation",
      title: "Uzlaşdırmada açıq sətirlər",
      detail: "Bank çıxarışında 2 əməliyyat uyğunlaşdırılmayıb.",
      level: "low",
      href: "/reconciliation",
    },
  ],
} as const;
