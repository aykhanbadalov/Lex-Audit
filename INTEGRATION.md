# Real backend ilə inteqrasiya

Mənbə: backend repo-sunun `backend/openapi.json` faylı **həqiqi müqavilədir**; bura `contract/openapi.json` kimi kopyalanıb.
`pnpm api:sync` (backend qovluğu `BACKEND_DIR` ilə verilir) onu yeniləyir və `src/api/schema.d.ts`-i yenidən yaradır.
Hər çağırış tiplidir: `api.GET("/news")` yolunun cavabı müqavilədən gəlir, `src/api/types.ts` yalnız `Json<>`, `Body<>`, `Item<>` köməkçiləridir.

## Vəziyyət: bütün modullar real müqaviləyə keçib

| Modul          | Real endpoint-lər                                                                 | Qeyd                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Giriş          | `/auth/login`, `/auth/csrf`, `/auth/refresh`, `/auth/logout`, `/me`               | CSRF + HttpOnly cookie, 2FA kodu (`mfaCode`). `/me` ad vermir, e-poçt göstərilir.                                                                                         |
| Başlanğıc      | `/notifications`, `/tax-calendar`                                                 | Bildirişlər və yaxınlaşan vergi tarixləri                                                                                                                                 |
| Xəbərlər       | `/news`, `/news/{id}`, `/news/sources`, read/bookmark                             | Süzgəc: mənbə, oxunmamış, əlfəcin, mətn. Kateqoriya/risk/tarix süzgəci backend-də yoxdur. "Şirkətə təsir" `/impact-findings`-dən gəlir.                                   |
| Qanunvericilik | `/legislation`, `/{id}?date=`, `/versions`, `/diff`                               | Siyahı `offset` ilə; versiya mətni tarixə görə; fərq abzas səviyyəsindədir                                                                                                |
| Fayllar        | `/files` (multipart), siyahı, `PATCH`, `archive`, `restore`, `reindex`, `content` | İndeks statusu `extractionStatus`                                                                                                                                         |
| Qaimələr       | `/invoices`, `upload`, `{id}`, `PATCH`, `validate`, `source`, `propose-entries`   | Saxlamaq = `PATCH` + avtomatik `validate`. Qaimə yüklənəndə sətir bir az sonra görünür                                                                                    |
| ƏDV            | `/vat/periods`, `summary`, `draft-return`, `deposit-statements`                   | Depozit çıxarışı yalnız yüklənir (oxuyan endpoint yoxdur)                                                                                                                 |
| Jurnal         | `/journal`, `{id}`, `submit` (202), `/accounts`                                   | Postlama başqa şəxsin təsdiqi ilə olur                                                                                                                                    |
| Təsdiqlər      | `/approvals`, `{id}`, `decide {approve                                            | reject}`                                                                                                                                                                  | Növlər: `journal_post`, `tax_rate_proposal`, `import_commit`, `tool:*` |
| Audit          | `/audit-events?limit` (maks. 200)                                                 | Süzgəc və CSV ixracı brauzerdə, gələn 200 hadisə üzərində                                                                                                                 |
| Assistent      | `/conversations`, `…/messages` (SSE), `/messages/{id}/feedback`                   | Hadisələr: `message.created`, `step`, `delta`, `tool.call`, `tool.result`, `final`, `error`, `done`. Dayandırmaq = bağlantını kəsmək. Davam etdirmə və ad dəyişmə yoxdur. |
| Excel          | `/excel/jobs` (profile, clean, report)                                            | İş fonda gedir, nəticə yeni fayldır                                                                                                                                       |
| Uzlaşdırma     | `/reconciliations`, `{id}`, `matches/{m}/confirm`                                 | Təkliflər, insan təsdiq edir                                                                                                                                              |
| İdxal          | `/imports/preview`, `{id}`, `{id}/commit` (202)                                   | İcra təsdiq tələb edir; `/journal/export-1c`                                                                                                                              |
| Admin          | `/admin/users                                                                     | roles                                                                                                                                                                     | sources                                                                | tax-rates | models | alerts` | Rol/model dəyişiklikləri **dərhal** tətbiq olunur; dərəcənin aktivləşməsi təsdiqlə |

İcazə adları backend-in adlarıdır (`journal:*`, `excel:use`, `imports:commit`, `users:*`, `roles:*`, `platform:admin`, …) və heç bir tərcümə yoxdur.

## Yoxlama

- Vahid və komponent testləri (`pnpm test`) sınaq üçün saxta backend (MSW) işlədir. Onun cavabları real formaya çevrilir (`src/mocks/wire.ts` və `handlers/*`).
- `pnpm e2e` həmin saxta backend ilə brauzerdə, `pnpm e2e:demo` qurulmuş demo paketində işləyir.
- **`pnpm e2e:real` həqiqi backend-ə qarşı işləyir** (varsayılan `http://127.0.0.1:8080`): giriş, 20 ekranın hamısının yüklənməsi,
  qaimənin düzəldilməsi, jurnal yazılışının təklifi, başqa istifadəçinin təsdiqi və assistentin axınla cavabı.
  Demo məlumatla yoxlanır (`SEED_DEMO_DATA=true`, `admin@demo.lexaudit.local`). Təkrar işlətməzdən əvvəl backend-i yenidən başladın:
  test seed məlumatını dəyişir.
- Assistentin axını üçün backend-ə OpenAI uyğun bir model lazımdır (`MODEL_SERVING_BASE_URL`). Modelsiz backend `503` cavabı verir və ekran bunu sözlə göstərir.

## Backend-dən gözlənilənlər / açıq suallar

- Təsdiq cavabında başlıq, ad və "nə dəyişəcək" yoxdur; yalnız `kind`, `resourceRef`, iki istifadəçi id-si. Ekran növə görə izah edir
  (jurnal yazılışı üçün sətirləri özü oxuyur). Adlar üçün `users:read` lazımdır.
- Audit jurnalında süzgəc, axtarış və ixrac yoxdur (`limit` ≤ 200). Aktyor yalnız id ilə gəlir.
- Assistent mesajında alət nəticəsinin statusu saxlanmır; yalnız axın zamanı görünür. Mənbə (`citations`) yalnız `label` və `chunkId` verir, açmaq üçün ünvan yoxdur.
- Qaimələrin siyahısında axtarış və "yalnız problemli" süzgəci yoxdur; sətir əlavə/silmək üçün endpoint yoxdur.
- ƏDV depozit çıxarışını oxuyan endpoint yoxdur.
