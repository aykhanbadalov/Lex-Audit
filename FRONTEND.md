# LexAudit AI — Frontend Planı

> Bu qovluq (`frontend/`) veb tətbiqin (brauzerdə işləyən SPA) bütün UI kodunu saxlayacaq.
> Backend: [`../backend/BACKEND.md`](../backend/BACKEND.md) · Model: [`../model-training/MODEL_TRAINING.md`](../model-training/MODEL_TRAINING.md) · Köhnə kodun səhvləri: [`../audit.md`](../audit.md)

---

## 1. Məqsəd

Mühasib, auditor və compliance mütəxəssisi üçün veb tətbiq (brauzerdə işləyir, quraşdırma tələb etmir):

- Elektron qaimə-fakturaları (e-qaimə), e-kassa çeklərini və skan sənədləri yükləmək, AI ilə oxumaq, ƏDV-ni yoxlamaq
- ƏDV depozit hesabı çıxarışı ilə uzlaşdırma
- 1C-dən export olunmuş məlumatları import etmək, 1C-yə import faylı yaratmaq
- Excel faylları ilə işləmək: profil, təmizləmə, uzlaşdırma, hesabat
- Jurnal yazılışlarını AI təklifi ilə hazırlamaq və təsdiqə göndərmək
- ƏDV bəyannaməsinin qaralamasını görmək
- Xəbərlər / qanunvericilik lentini izləmək, dəyişikliyin şirkətə təsirini görmək
- Qanun bazasında axtarış və mənbəli AI chat (RAG)
- Təsdiq növbəsi, audit jurnalı, admin idarəetməsi

Frontend **heç bir biznes qərarı vermir**: hesablama, icazə və AI çağırışı backend-dədir. Frontend yalnız göstərir, toplayır və təsdiq alır.

---

## 2. Texnologiya

| Sahə | Seçim | Səbəb |
|---|---|---|
| Dil | **TypeScript** (strict) | Kontrakt təhlükəsizliyi |
| UI framework | **React 19** | Ən geniş ekosistem, developer tapmaq asandır |
| Build | **Vite** | Sürət; statik SPA build (SSR lazım deyil) |
| Routing | **TanStack Router** | Tip təhlükəsiz route və query parametrləri |
| Server state | **TanStack Query** | Keş, retry, invalidasiya |
| UI state | **Zustand** | Yalnız qlobal UI vəziyyəti üçün (sidebar, tema, aktiv şirkət) |
| UI komponentləri | **shadcn/ui** + **Radix UI** | Əlçatan (a11y), kodu bizdə olan komponentlər |
| Stil | **Tailwind CSS 4** | Dizayn tokenləri |
| İkonlar | **lucide-react** | |
| Formalar | **react-hook-form** + **zod** | Validasiya sxemi API kontraktı ilə eyni |
| Cədvəl | **TanStack Table v8** + **TanStack Virtual** | Böyük qaimə/Excel siyahıları. v9 hələ dəyişkən API-dir, ona görə v8-ə pin olunub |
| Bildirişlər | **sonner** (toast) | |
| Excel önbaxış | **SheetJS (xlsx)** — yalnız oxumaq üçün; ağır iş backend-də | |
| PDF önbaxış | **react-pdf** (pdf.js) | Qaimə PDF-ləri |
| Diaqram | **Recharts** | Dashboard |
| Markdown (AI cavabları) | **react-markdown** + **rehype-sanitize** | Təhlükəsiz render |
| i18n | **react-i18next** — `az` (əsas), `ru`, `en` | Azərbaycan bazarı |
| API client | **openapi-typescript** + **openapi-fetch** | Tiplər backend-in OpenAPI sxemindən avtomatik |
| Mock | **MSW** (Mock Service Worker) | Backend hazır olmadan işləmək |
| Test | **Vitest**, **React Testing Library**, **Playwright** | |
| Lint/format | **ESLint** (typescript-eslint, react-hooks), **Prettier** | TypeScript 6.x-ə pin olunub: typescript-eslint hələ 7-ni dəstəkləmir |
| Paket meneceri | **pnpm** | Sürətli, sərt dependency idarəsi |

---

## 3. Qovluq strukturu

```
frontend/
├── FRONTEND.md                  # bu sənəd
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts
├── tsconfig.json
├── index.html
├── components.json              # shadcn/ui konfiqurasiyası
├── .env.example                 # VITE_API_BASE_URL, VITE_DEFAULT_LOCALE, VITE_ENABLE_MSW
├── public/
│   └── mockServiceWorker.js
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── router.tsx           # TanStack Router: route ağacı, guard-lar
│   │   ├── providers.tsx        # QueryClient, i18n, theme, auth provider
│   │   └── layouts/             # AppLayout.tsx, AuthLayout.tsx
│   ├── api/
│   │   ├── client.ts            # openapi-fetch: base URL, token, refresh, error mapping
│   │   ├── sse.ts               # chat streaming üçün SSE client
│   │   ├── schema.d.ts          # openapi-typescript çıxışı (əl ilə dəyişilmir)
│   │   └── errors.ts            # ApiError, xəta kodları
│   ├── mocks/
│   │   ├── browser.ts           # MSW start
│   │   ├── handlers/            # modul üzrə mock handler-lər
│   │   └── fixtures/            # realistik test məlumatı
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── invoices/            # Qaimələr
│   │   ├── vat/                 # ƏDV, ƏDV depozit hesabı
│   │   ├── integrations/        # 1C import/export, e-taxes faylları
│   │   ├── ledger/              # Jurnal yazılışları, hesablar planı
│   │   ├── excel/               # Excel workbench
│   │   ├── reconciliation/      # Bank ↔ jurnal uzlaşdırma
│   │   ├── news/                # Xəbərlər / qanunvericilik lenti
│   │   ├── legislation/         # Qanun bazası, versiyalar, diff
│   │   ├── assistant/           # AI chat (RAG + alətlər)
│   │   ├── files/               # Sənəd anbarı
│   │   ├── approvals/           # Təsdiq növbəsi
│   │   ├── audit-log/           # Audit jurnalı
│   │   └── admin/               # İstifadəçilər, rollar, mənbələr, model versiyaları
│   ├── shared/
│   │   ├── ui/                  # shadcn/ui komponentləri (Button, Dialog, Table, ...)
│   │   ├── components/          # EmptyState, ErrorState, PermissionDenied, DataTable, MoneyText ...
│   │   ├── hooks/               # usePermission, useTheme, useDebounce
│   │   ├── stores/              # Zustand store-lar
│   │   └── lib/                 # money.ts (decimal string formatlama), date.ts, cn.ts
│   ├── locales/
│   │   ├── az.json
│   │   ├── ru.json
│   │   └── en.json
│   └── styles/
└── tests/
    └── e2e/                     # Playwright
```

Hər `features/<ad>/` daxilində eyni struktur:

```
features/invoices/
├── api.ts            # bu modulun TanStack Query hook-ları (useInvoices, useUpdateInvoice ...)
├── types.ts          # generated tiplərdən re-export / UI tipləri
├── routes/           # səhifə komponentləri
├── components/
├── schemas.ts        # zod form sxemləri
└── __tests__/
```

---

## 4. Modullar (ekranlar) — detallı

### 4.1 Auth
- **Route:** `/login`, `/forgot-password`
- Email + şifrə, sonra (istəyə bağlı) 2FA.
- Token: access token yalnız yaddaşda (memory); refresh token backend tərəfindən `HttpOnly; Secure; SameSite=Strict` cookie kimi qoyulur — JS ona çata bilmir. `localStorage`/`sessionStorage`-da token **saxlanmır** (audit A-02).
- 401 → avtomatik refresh → uğursuzsa login-ə yönləndir (audit A-07).

### 4.2 Dashboard (`/`)
- Bu günün tapşırıqları: emal gözləyən qaimələr, uyğunsuzluqlar, yaxınlaşan bəyannamə tarixləri
- Yeni qanun/xəbər kartları (risk səviyyəsi ilə) + "şirkətinizə təsiri"
- Gözləyən təsdiqlər (yalnız icazəsi olana)
- Sistem vəziyyəti: mənbələrin son yenilənmə vaxtı, AI xidmətinin vəziyyəti

### 4.3 Qaimələr (`/invoices`, `/invoices/:id`)
- **Yükləmə:** drag & drop — e-taxes.gov.az portalından endirilmiş e-qaimə faylları (Excel/XML), PDF, şəkil (JPG/PNG), e-kassa çekləri (fiskal ID ilə), ZIP
- **Siyahı:** status (`uploaded → extracting → extracted → validated → posted | rejected`), satıcı, VÖEN, tarix, məbləğ, ƏDV, uyğunsuzluq sayı; filtr + axtarış + virtual scroll
- **Detal ekranı (split view):**
  - Sol: PDF/şəkil önbaxışı, AI-ın tapdığı sahələr rəngli çərçivə ilə
  - Sağ: çıxarılmış sahələr (redaktə oluna bilir), sətirlər cədvəli, hər sahənin **etibar dərəcəsi** (confidence)
  - Validasiya nəticələri: "ƏDV 20% olmalı idi, 18% hesablanıb", "Cəm uyğun gəlmir", "VÖEN formatı səhvdir"
  - AI-ın təklif etdiyi jurnal yazılışı → "Təsdiqə göndər"
- Mühasibin düzəlişləri backend-ə `feedback` kimi göndərilir (model train məlumatı).

### 4.4 ƏDV (`/vat`)
- Dövr seçimi (ay/rüb)
- Hesablanmış ƏDV / əvəzləşdirilən ƏDV / ödəniləcək (və ya qaytarılacaq) məbləğ
- **ƏDV depozit hesabı uzlaşdırması:** depozit hesabı çıxarışı ↔ uçotdakı ƏDV hərəkətləri, fərqlərin siyahısı
- Azadolma və 0% dərəcəli əməliyyatların ayrıca göstərilməsi
- Hər rəqəmin "haradan gəldi" izahı (hansı qaimələr) — drill-down
- Bəyannamə qaralaması (yalnız önbaxış + export: PDF/XLSX/XML)
- Dərəcə cədvəli (read-only, mənbə linki ilə)

### 4.5 Jurnal / Hesablar planı (`/ledger`)
- Jurnal yazılışları siyahısı (debet/kredit, balans yoxlaması göstərilir)
- AI təklif etdiyi yazılışlar — "Təklif", "Təsdiq gözləyir", "Yazılıb" statusları
- Hesablar planı ağacı (Kommersiya təşkilatları üçün Hesablar Planı + şirkətin alt hesabları)

### 4.6 Excel workbench (`/excel`)
- Fayl yüklə → **profil:** sütunlar, tiplər, boş xanalar, dublikatlar, ehtimal olunan mənası ("bu sütun VÖEN-dir")
- **Əməliyyatlar** (backend-də icra olunur): təmizlə, sütun xəritələ, uzlaşdır, pivot, hesabat yarat
- AI-a təbii dildə əmr: "Bu cədvəldə ƏDV-si səhv olan sətirləri tap"
- Nəticə həmişə **yeni fayl** olaraq yaranır, orijinal dəyişmir; diff önbaxışı göstərilir
- Export: XLSX, CSV

### 4.7 Uzlaşdırma (`/reconciliation`)
- İki mənbə seç (bank çıxarışı ↔ jurnal, qaimələr ↔ e-qaimə portalı)
- Uyğun gələn / uyğun gəlməyən / qismən uyğun sətirlər
- AI-ın uyğunlaşdırma təklifləri (confidence ilə), əl ilə təsdiq

### 4.7.1 İnteqrasiyalar (`/integrations`)
- **1C import:** 1C-dən export edilmiş Excel/XML (hesablar, kontragentlər, jurnal, qalıqlar) → sütun xəritələmə sehrbazı → önbaxış → import
- **1C export:** təsdiqlənmiş jurnal yazılışları 1C-yə import ediləcək formatda
- **e-taxes faylları:** portaldan endirilən e-qaimə reyestri, ƏDV depozit hesabı çıxarışı
- **Bank çıxarışları:** Azərbaycan banklarının Excel/CSV formatları (bank üzrə şablon)
- Hər import: nə qədər sətir, xətalar, dublikatlar — import yalnız təsdiqdən sonra

### 4.8 Xəbərlər (`/news`, `/news/:id`)
- Lent: mənbə (e-qanun.az, taxes.gov.az, Maliyyə Nazirliyi, CBAR, Milli Məclis, Nazirlər Kabineti, DSMF, IFRS Foundation …), kateqoriya, risk səviyyəsi, tarix
- Filtrlər: mənbə, kateqoriya, risk, tarix aralığı, oxunub/oxunmayıb, əlfəcin
- Detal: orijinal mətn + AI xülasəsi (ayrıca işarələnmiş), risk izahı, əlaqəli qanun maddələri, **şirkətə təsir** (hansı fayl/qeyd/audit tapıntısı), orijinal link
- "AI-dan soruş" düyməsi → bu xəbəri kontekst kimi chat-ə əlavə edir

### 4.9 Qanunvericilik (`/legislation`, `/legislation/:id`)
- Qanun / məcəllə / Nazirlər Kabinetinin qərarı / standart (MMUS, MHBS) siyahısı
- Maddə üzrə naviqasiya, **versiya tarixçəsi**, iki versiya arasında **diff** görünüşü
- "Bu tarixdə qüvvədə olan versiya" seçimi

### 4.10 AI Assistent (`/assistant`)
- Söhbətlər siyahısı (sol), chat (orta), mənbələr/alətlər paneli (sağ)
- **SSE streaming** — hadisələr: `message.delta`, `citation.added`, `tool.requested`, `tool.result`, `tool.approval_required`, `message.completed`, `message.failed`
- Hər cavabın altında **mənbələr** (qanun maddəsi, xəbər, fayl) — kliklənir, mətn parçası göstərilir
- Alət kartları: AI hansı aləti hansı arqumentlə çağırdı, nəticə nə oldu
- Yazma alətləri üçün təsdiq kartı — **yalnız təsdiq icazəsi olan və sorğu edən olmayan** istifadəçiyə düymə görünür (audit A-03); server də yoxlayır
- Kontekst əlavə et: qaimə, fayl, xəbər, Excel
- 👍 / 👎 + "düzgün cavab budur" sahəsi → model feedback

### 4.11 Fayllar (`/files`)
- Qovluqlar, teqlər, versiyalar, indeksləmə statusu (`pending → extracting → embedding → ready | failed`), yenidən cəhd
- Arxivləmə (soft delete), bərpa

### 4.12 Təsdiqlər (`/approvals`)
- Növbə: alət əməliyyatları, giriş sorğuları, dərəcə dəyişikliyi təklifləri, model buraxılışları
- Hər biri üçün: kim istədi, nə dəyişəcək (before/after diff), risk, son tarix
- Təsdiq/rədd + şərh məcburi

### 4.13 Audit jurnalı (`/audit-log`)
- Dəyişməz hadisələr siyahısı: kim, nə vaxt, nə etdi, hansı resurs, nəticə
- Filtr + export

### 4.14 Admin (`/admin`)
- İstifadəçilər və rollar
- Xəbər mənbələri (aktiv/deaktiv, son fetch, xətalar)
- Vergi dərəcələri cədvəli (dəyişiklik yalnız təsdiq ilə)
- **Model idarəetməsi:** aktiv model versiyası, eval nəticələri, canary, rollback düyməsi (təsdiqlə)
- Sistem sağlamlığı

---

## 5. Rollar və icazələr (UI tərəfi)

| Rol | Əsas icazələr |
|---|---|
| `viewer` | Oxumaq: dashboard, xəbər, qanun |
| `accountant` | Qaimə yükləmək/redaktə, Excel, assistent, jurnal **təklifi** |
| `chief_accountant` | + jurnal təsdiqi, ƏDV bəyannaməsi, təsdiq növbəsi |
| `auditor` | Hər şeyi oxumaq, audit jurnalı, export; yazma yox |
| `admin` | İstifadəçi, mənbə, dərəcə, model idarəetməsi |

- `usePermission('invoices:write')` hook-u yalnız UI üçündür; **əsl yoxlama backend-dədir**.
- Route guard (TanStack Router `beforeLoad`): `permissions` + `requiresAuth` — hər ikisi həmişə yoxlanır (audit A-11).

---

## 6. API ilə əlaqə qaydaları

- Bütün tiplər backend-in OpenAPI sxemindən generasiya olunur: `npm run api:gen`.
- Pul məbləğləri **string** kimi gəlir (`"12500.00"`) — JS `number` ilə hesablama **edilmir**; yalnız formatlanır.
- Xəta formatı: `{ error: { code, message, requestId, details? } }` → `ApiError` → i18n mesajı.
- `404` → "tapılmadı" ekranı; heç vaxt başqa qeyd göstərilmir (audit A-05).
- Yazma əməliyyatları `Idempotency-Key` başlığı ilə göndərilir.
- SSE bağlantısı kəsiləndə `Last-Event-ID` ilə bərpa.

---

## 7. UI vəziyyətləri (hər ekranda məcburi)

`loading` · `empty` · `no-results` · `error + retry` · `permission-denied` · `offline/backend-unavailable` · `partial` (məs. embedding gözləyir)

---

## 8. Təhlükəsizlik

- Sərt CSP veb serverin başlığı ilə: `default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'` (audit A-06)
- Frontend və API eyni origin-dən verilir (reverse proxy: `/` → statik build, `/api` → backend) — CORS problemi və cookie riskləri azalır
- Digər başlıqlar: `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin`
- `dangerouslySetInnerHTML` qadağandır (ESLint qaydası); AI cavabları `react-markdown` + `rehype-sanitize` ilə
- Token heç vaxt `localStorage`-da saxlanmır; refresh cookie üçün CSRF qorunması (SameSite + `X-CSRF-Token`)
- Xarici linklər `rel="noopener noreferrer"`, yalnız `http/https`

---

## 9. i18n

- Bütün mətnlər, o cümlədən route başlıqları və səhv mesajları, `locales/*.json`-dan gəlir (audit A-14)
- Default dil: `az`; `ru`, `en` dəstəyi
- Pul/tarix formatı locale-a görə (`Intl.NumberFormat`, `Intl.DateTimeFormat`); valyuta: AZN (əsas), USD, EUR, RUB, TRY
- CI-da yoxlama: bütün dillərdə açarlar eynidir

---

## 10. Test strategiyası

| Səviyyə | Alət | Nə yoxlanır |
|---|---|---|
| Unit | Vitest | `money.ts`, guard-lar, hook-lar, Zustand store-lar |
| Komponent | React Testing Library | Qaimə formu, təsdiq kartı (icazəsiz gizlidir), cədvəllər |
| Kontrakt | MSW + generated tiplər | API cavablarının sxemə uyğunluğu |
| E2E | Playwright | Login → qaimə yüklə → düzəlt → təsdiqə göndər → chief təsdiqləyir |
| Vizual | Playwright screenshot | Əsas ekranlar, açıq/qaranlıq tema |

---

## 11. İnkişaf ardıcıllığı

| # | Addım | Nəticə |
|---|---|---|
| F1 | Layihə skeleti: Vite + React + TS, Tailwind, shadcn/ui, router, lint, test, CI | Boş tətbiq açılır |
| F2 | Dizayn sistemi + layout + i18n (az/ru/en) | Shared komponentlər |
| F3 | API client, generated tiplər, MSW mock | Backend olmadan işləmək |
| F4 | Auth + rollar + guard-lar | Login, refresh, icazələr |
| F5 | Xəbərlər + qanunvericilik | Lent, detal, diff |
| F6 | Fayllar | Yükləmə, indeks statusu |
| F7 | Qaimələr | Yükləmə, çıxarış önbaxışı, validasiya |
| F8 | ƏDV + jurnal | Dövr xülasəsi, yazılış təklifləri |
| F9 | Excel workbench + uzlaşdırma | |
| F10 | AI Assistent (SSE, mənbələr, alətlər, feedback) | |
| F11 | Təsdiqlər + audit jurnalı | |
| F12 | Admin + model idarəetməsi | |
| F13 | E2E testlər, a11y, performans, production build + deploy (statik hosting) | |

---

## 12. Qəbul meyarları (Definition of Done)

- `tsc --noEmit`, ESLint, Vitest, Playwright CI-da yaşıl
- Hər ekranda 7 UI vəziyyəti var
- Heç bir sabit (hardcoded) məlumat yoxdur, hamısı API-dən
- Bütün mətnlər i18n-dədir
- Pul məbləğləri `number` ilə hesablanmır
- Təsdiq düymələri yalnız icazəli istifadəçiyə görünür
