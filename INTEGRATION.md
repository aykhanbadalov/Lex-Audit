# Real backend ilə inteqrasiya

Mənbə: `../../invoice_backend` (yalnız oxunub, orada heç nə dəyişdirilməyib). Onun `backend/openapi.json` faylı **həqiqi
müqavilədir** və bura `contract/openapi.json` kimi kopyalanıb (`pnpm api:sync` yeniləyir). Əvvəl yazılmış qaralama
`../backend/openapi.yaml` yalnız hələ köçürülməmiş modullar üçün qalıb.

## İş qaydası

- `src/api/real/schema.d.ts` həqiqi müqavilədən yaradılır (`pnpm api:gen:real`), `realApi` ondan tipləşir.
- `api` (qaralama tipləri) və mock-lar hələ köçürülməmiş modulları saxlayır. Modul köçürüləndə: `realApi`-yə keç → mock-u
  həqiqi forma ilə əvəz et → testləri yenilə. Hamısı bitəndə qaralama müqavilə və `src/api/schema.d.ts` silinir.
- Real backend ilə yoxlama: `E2E_BROWSER_CHANNEL=chrome pnpm e2e:real` (backend `localhost:8080`-də işləməlidir; admin hesabı
  `REAL_ADMIN_EMAIL` / `REAL_ADMIN_PASSWORD`).

## Hazır: giriş (auth)

- Login → `{accessToken, csrfToken, expiresInSeconds}`, sonra **`GET /me`** istifadəçini və icazələri verir (adı yoxdur,
  e-poçt göstərilir).
- Səhifə yenilənəndə: `GET /auth/csrf` (cookie ilə) → `POST /auth/refresh` + `X-CSRF-Token`. Logout da CSRF tələb edir.
- İkifaktorlu giriş: backend `401 "MFA code required"` deyəndə forma kod sahəsini göstərir (F4-ün 2FA hissəsi bağlandı).
- İcazə adları: backend `journal:*`, `excel:use`, `imports:commit`, `users:read`, `platform:admin` deyir; ekranlar köhnə adlarla
  yazılıb. Tərcümə yalnız `src/api/mapSession.ts`-də aparılır, naməlum kod olduğu kimi keçir.

## Modullar: nə uyğun gəlir, nə yox

| Modul                      | Real backend                                                                                                                           | Ekrandan fərq / çatışmayan                                                                                                                                                                                                         |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Xəbərlər                   | `GET /news` (sourceId, unread, bookmarked, q, cursor), `PUT /news/{id}/read`, `/bookmark`                                              | Kateqoriya/risk/tarix filtri yoxdur. Mənbə siyahısı yalnız `platform:admin` üçündür (`/admin/sources`), adi istifadəçi filtr üçün ala bilmir. `aiSummary`, `aiRiskLevel`, `aiTags` var; "şirkətə təsir" ayrıca `/impact-findings`. |
| Qanunvericilik             | siyahı (type, q, **offset**), `GET /{id}?date=` (versiya + tam mətn), `/versions`, `/diff?from&to`                                     | Siyahı massivdir (cursor yox). Diff `hunks` formatı yoxlanmalıdır.                                                                                                                                                                 |
| Fayllar                    | `POST /files` (multipart), siyahı, `PATCH`, `archive`, `content`, `reindex`                                                            | Arxivdən bərpa yoxdur. İndeks statusu `pending/extracting/ready/failed` (embedding mərhələsi ayrıca görünmür).                                                                                                                     |
| Qaimələr                   | siyahı, `upload` (202 + fileId), `GET/PATCH`, `validate`, `propose-entries`                                                            | `needs_review/extracted/validated/posted` statusları; sətir/issue formaları yenidən uyğunlaşdırılmalıdır.                                                                                                                          |
| ƏDV                        | `periods`, `periods/{p}/summary`, `draft-return`, `deposit-statements` (POST)                                                          | Depozit uzlaşdırmasını oxuyan endpoint yoxdur. Dərəcələr `/tax-rates` (`ratePercent`).                                                                                                                                             |
| Jurnal                     | siyahı, detal, `submit` (202 + təsdiq), `/accounts`, `PUT /chart-of-accounts`, `export-1c`                                             | `proposed/approved/posted`; hesab planı yeniləmə var.                                                                                                                                                                              |
| Excel / uzlaşdırma / idxal | `excel/jobs` (profile, clean, reconcile, report), `reconciliations`, `imports/preview → commit (202 təsdiq)`                           | Qaralamadakı "workbook + əməliyyat" modeli yoxdur; iş (job) modelidir. Uzlaşdırmada yalnız `confirm` var, `reject` yoxdur.                                                                                                         |
| Assistent                  | `conversations` (siyahı, yarat, detal), `POST …/messages` (SSE), `messages/{id}/feedback`                                              | Yenidən adlandırma/arxiv, `stop`, `resume` (Last-Event-ID) **yoxdur**. Rəy `thumbs` və `correction` olaraq ayrılıb. Hadisə adları SSE-də yoxlanmalıdır.                                                                            |
| Təsdiqlər                  | `GET /approvals` (massiv, süzgəcsiz), `decide {approve\|reject}`                                                                       | Cavabda ad yox, yalnız `requesterId` var; "nə dəyişəcək" cədvəli yoxdur (`resourceRef`, `execution` var).                                                                                                                          |
| Audit jurnalı              | `GET /audit-events?limit`                                                                                                              | Filtr, axtarış, tarix və ixrac **yoxdur**; `actorId` UUID-dir. `before/after` var.                                                                                                                                                 |
| Admin                      | `users` (+status, rollar), `roles` (+icazələr), `sources`, `tax-rates` (+`request-activation`), `models` (+status), `alerts`, `health` | Rol dəyişikliyi və model statusu **dərhal** tətbiq olunur (təsdiqsiz). Dərəcə aktivləşməsi təsdiqlə gedir.                                                                                                                         |
| Dashboard                  | yoxdur                                                                                                                                 | `notifications`, `tax-calendar`, `impact-findings` var; "bu gün" ekranı bunlardan qurula bilər.                                                                                                                                    |
| Axtarış                    | `POST /search` (vektor + tam mətn)                                                                                                     | Ekranda hələ yoxdur.                                                                                                                                                                                                               |

## Backend-ə bildirilməli səhv (tapıldı, düzəldilmədi)

**Real HTTP sorğusunda proses çökür.** `src/app.ts` `logMethod` hook-u hər log arqumentini `maskJsonValue` ilə dərin gəzir.
Fastify `{ req }` obyektini loga verəndə `req.raw.socket.parser.socket…` dövrü sonsuz rekursiyaya düşür
(`RangeError: Maximum call stack size exceeded`, `src/audit/pii.ts`). Təkrar: serveri işə sal, `POST /api/v1/auth/login` göndər.
Testlər `inject()` ilə işlədiyi üçün tutulmur. Təklif: `maskJsonValue`-ya `WeakSet` ilə dövr və dərinlik qoruması əlavə etmək
və/və ya `maskLogArg`-da `req`/`res` açarlarını dərin gəzməmək. Yoxlama zamanı yalnız `/private/tmp`-dakı kopyada belə
düzəldildi, `invoice_backend` qovluğu toxunulmaz qalıb.
