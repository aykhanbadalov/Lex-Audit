# What the frontend needs from the backend

This is the list the frontend keeps while it runs on mocks. The machine-readable part is
[`../backend/openapi.yaml`](../backend/openapi.yaml). This file covers what an OpenAPI file cannot say:
behaviour, headers, security settings and open questions. When the backend is ready, walk this list top to bottom.

Legend: ✅ the mock already does it and the frontend relies on it · ❓ open question for the backend developer.

---

## 1. Transport and security

- ✅ Everything under `/api/v1`. The frontend and the API are served from **one origin** (reverse proxy: `/` serves the
  static build, `/api` goes to the backend). In development Vite proxies `/api` to `VITE_API_PROXY_TARGET`.
- ✅ **Refresh token = `HttpOnly; Secure; SameSite=Strict` cookie**, path `/api/v1/auth`. The access token is returned in
  the JSON body and kept in memory only. Refresh **rotates** the cookie.
- ✅ Access token lifetime ~15 minutes. A request with an expired token must return **401** with the error envelope
  (the frontend then refreshes once and replays the request).
- ❓ CSRF: the refresh and logout endpoints are cookie-authenticated. With `SameSite=Strict` and one origin this is
  covered; if the origin ever differs, an `X-CSRF-Token` header will be needed.
- ✅ Security headers come from the web server, not the app: `Content-Security-Policy: default-src 'self'; connect-src 'self';
img-src 'self' data: blob:; frame-ancestors 'none'`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: same-origin`. The PDF preview needs `worker-src 'self' blob:`.
- ✅ Every error uses the envelope `{ "error": { "code", "message", "requestId" } }`. Unknown or foreign-tenant ids return
  **404**, never another resource. A missing permission returns **403**.
- ✅ Every request carries `X-Request-Id` (a UUID). Please echo it back in `error.requestId` and put it in logs.
- ❓ Rate limiting on `/auth/login` (429 with `Retry-After`). The login screen shows a generic message for now.

## 2. Authorization

- ✅ The frontend hides what a user may not use, based on `user.permissions` from login/refresh. The backend enforces the
  same permissions on every request. Permission keys used so far:
  `dashboard:view`, `invoices:read`, `invoices:write`, `vat:read`, `ledger:read`, `excel:read`, `news:read`,
  `legislation:read`, `files:read`, `files:write`, `assistant:use`, `approvals:read`, `approvals:decide`, `admin:manage`.
  ❓ Please confirm or rename; the frontend follows whatever the backend names them.
- ✅ A user who may not read a module must get **403** from its endpoints (the frontend never calls them, but the test
  mocks assert the 403).
- ❓ Separation of duties: the person who requested a change cannot approve it. Frontend hides the button; backend must reject.

## 3. Lists and paging

- ✅ Cursor paging: `?cursor=&limit=` → `{ items, nextCursor }`. `nextCursor: null` means the last page.
- ✅ Filters are plain query parameters (see the contract). Text search `q` must be case-insensitive and
  Azerbaijani-aware (`İ/ı`, `ə`, `ş`, `ç`, `ğ`, `ö`, `ü`): lower-case with the `az` locale or use `unaccent` carefully.
- ❓ Is `nextCursor` stable if items are added while the user pages? (Frontend just appends pages.)

## 4. Money and dates

- ✅ Money is a **decimal string** (`"12500.00"`), never a JSON number. The frontend never does arithmetic on money.
- ✅ Instants are RFC 3339 UTC. Calendar dates (`validFrom`, `adoptedAt`) are plain `YYYY-MM-DD`.
- ✅ Totals, VAT amounts and rounding are computed **only** by the backend. The frontend sends edited fields and asks the
  backend to validate and recalculate.

## 5. News and legislation (phase F5)

- ✅ Source text (`body`) and AI output (`ai.*`) are separate fields and are never mixed. `ai.modelVersion` is shown to users.
- ✅ News detail: `PUT /news/{id}/read` is called when an item is opened.
- ❓ Impact findings (`impact[]`) need the company's own files and records indexed. Until then return `[]`.
- ❓ Legislation diff: the mock computes a word-level diff per article. The backend should do the same (or better), keeping
  `segments` as `equal | added | removed`.

## 6. Files (phase F6)

See `openapi.yaml` (`/files`). Behaviour the frontend relies on:

- ✅ **Upload** is `multipart/form-data` (`file`, optional `folder`, `tags`) with an `Idempotency-Key` header. It returns
  **201 immediately** with `status: "pending"`; extraction and indexing run in the background.
- ✅ Status lifecycle: `pending → extracting → ready | failed`. `failed` carries a human-readable `statusDetail`.
  The frontend **polls** `GET /files/{id}` (and the list) every few seconds while any visible file is not `ready`/`failed`.
  ❓ If the backend can push status changes (SSE), say so and polling can go.
- ✅ Limits enforced by the backend: **25 MB** per file, types `pdf, png, jpg, jpeg, xlsx, xls, csv, xml, zip`.
  Violations return **413** and **415**. The frontend checks the same limits first for a quicker message.
  ❓ Please expose the limits (`GET /config`) so the two sides cannot drift; the frontend currently has constants.
- ✅ Uploads use XHR (to show progress), with the access token in `Authorization`. A 401 triggers one refresh and one retry.
- ✅ `GET /files/{id}/content` returns the bytes with the stored name in `Content-Disposition`. The frontend downloads it
  with an authenticated `fetch` and a blob URL (an `<a href>` cannot send the bearer token).
- ❓ Virus scanning (ClamAV) result: should it be a status (`quarantined`)? The UI has no state for it yet.
- ❓ Soft delete only (`archive` / `restore`); there is no permanent delete in the UI.

## 7. Invoices (phase F7)

See `openapi.yaml` (`/invoices`, `/accounts`, `/tax-rates`, `/journal`). This is the part of the product where the
division of labour matters most.

- ✅ **The backend computes all money; the frontend only shows it.** `PATCH /invoices/{id}` takes corrected strings
  (quantity, unit price, VAT rate _code_), recalculates every line and total, validates again and returns the whole
  `InvoiceDetail`. The browser never adds, multiplies or rounds an amount. Rounding rule (per line, half away from zero,
  two decimals) must be agreed and documented by the backend developer; the mock uses it.
- ✅ **Printed vs recalculated totals.** `declaredTotals` is what the model read from the document; `netTotal/vatTotal/
grossTotal` are recalculated from the lines. A difference produces a `TOTAL_MISMATCH` issue.
- ✅ **Issues are codes plus params, not sentences.** The UI writes the sentence in the user's language. Codes in use:
  `MISSING_FIELD`, `INVALID_TAX_ID`, `TOTAL_MISMATCH`, `DUPLICATE_INVOICE`, `LOW_CONFIDENCE`, `DATE_IN_FUTURE`.
  Unknown codes fall back to `message`, so new codes can ship without breaking the UI, but each new code needs a
  translation added on the frontend. `fieldPath` uses `number`, `issueDate`, `counterpartyVoen`, … and
  `lines[<0-based index>].unitPrice` for lines; the UI focuses the matching input.
- ✅ **Status lifecycle:** `uploaded → extracting → extracted → validated → posted`, plus `rejected` and `failed`.
  `validated` means no open `error` or `warning` issue. The frontend polls while a status is `uploaded` or `extracting`.
  Editing is allowed only in `extracted` and `validated`; any other state must answer **409** to `PATCH`.
- ✅ **Upload** `POST /invoices/upload` returns **202** with the created invoices (one file can hold several, for example an
  e-invoice register). `Idempotency-Key` makes a retried upload return the same invoices.
- ✅ **Original document** `GET /invoices/{id}/source` returns the stored bytes with the right `Content-Type`. The
  frontend renders PDF (pdf.js, worker from our own origin) and images; anything else shows "no preview".
- ❓ **Highlighting a field on the document** (a box around where the model found a value) needs a page number and a
  bounding box per field. Not in the contract yet; add `fieldLocations` when the model service can produce it.
- ✅ **Account suggestions** (`accountSuggestion`) come with a confidence. When a person accepts or changes one, the
  chosen code arrives as `accountFinal`. **Please record the pair (suggestion, final) as training feedback**: this is the
  signal `model-training/MODEL_TRAINING.md` calls the most valuable.
- ❓ `GET /accounts` returns the whole chart in one list and the UI filters it in the browser. If a company has thousands
  of accounts, paging or server-side search is needed.
- ✅ `GET /tax-rates?type=VAT` lists the rates in force. Lines carry a rate **code** (`AZ_VAT_STANDARD`, …), never a number,
  so a rate change never requires editing invoices.
- ✅ **Journal:** `POST /invoices/{id}/propose-entries` creates an entry in `proposed` and nothing is posted.
  `POST /journal/{id}/submit` moves it to `pending_approval`. `balanced` is decided by the server. The requester must not be
  able to approve it (see §2); approval itself belongs to phase F11.
- ❓ Concurrent edits: two people editing one invoice. The mock does not detect it. Suggest an `If-Match` / `version`
  field so the second save gets **409** instead of silently overwriting.

## 8. VAT and ledger (phase F8)

See `openapi.yaml` (`/vat/...`, `/journal`). Again the server computes; the screens only show.

- ✅ **The summary decides what counts.** Only `validated` and `posted` invoices are included; everything else of the
  period is reported in `excludedInvoiceCount` and the UI says so in a warning. A figure must never look complete when it is
  not. ❓ Confirm the rule (which statuses count, and by which date: issue date was assumed).
- ✅ **Foreign currency is converted by the server** at the official Central Bank rate (`convertedInvoiceCount` tells the UI
  to mention it). ❓ Confirm with an accountant which date's rate applies to VAT (date of supply was assumed), and the rounding
  policy (the mock converts each line, then puts any cent of difference on the last line of the lighter side so the entry balances).
- ✅ `resultKind` (`payable` / `refundable` / `zero`) is decided by the server; the UI never compares amounts.
- ✅ **Deposit account:** movements come from the bank statement and are matched to invoices. The server suggests a match
  (`suggestedInvoiceId` + number). Confirming is `POST /vat/deposit-lines/{id}/match`; the UI asks first because there is **no
  undo** in the contract. ❓ Add `unmatch` if the business needs it. `difference` is `closingBalance - ledgerBalance` and
  `ledgerBalance` counts only matched movements.
- ✅ **Draft return** is a draft, never a filing; the UI says so and points to e-taxes.gov.az. A filed period must answer **409**
  to `POST .../draft-return`. Lines are stable codes (`OUTPUT_VAT`, `INPUT_VAT`, `VAT_PAYABLE`, …). ❓ Mapping them to the fields
  of the official form, and producing real PDF/XLSX/XML, is the backend's job. The mock returns placeholder files.
- ✅ **Tax calendar:** `dueDate` per period comes from the server (a calendar table), never hard-coded in the UI.
- ✅ **Ledger is kept in the base currency.** `JournalEntry.currency` is the base currency and `exchangeRate` says what was used.
  The invoice screen used to show an entry in the invoice's currency; it now shows what the server sends.
- ✅ **Permissions:** `vat:write` (prepare draft, match movements) and `ledger:write` (send an entry for approval) are separate
  from the read permissions. ❓ Names to be confirmed (see §2).
- ❓ `GET /accounts` has `parentCode`. The UI nests children under their parent when it is present and shows a flat list
  grouped by type otherwise. The mock has no hierarchy because inventing one would mean inventing the chart of accounts.
- ❓ `GET /invoices` now takes `vatPeriod` and `vatBucket` so a figure on the VAT screen can be traced to its invoices. The
  server must use the same inclusion rule there as in the summary, or the counts will not match.

## 9. Excel, reconciliation and imports (phase F9)

See `openapi.yaml` (`/excel/...`, `/reconciliations`, `/imports`, `/exports/onec`).

- ✅ **The original spreadsheet is never modified.** Every Excel operation produces a **new file stored under Files**
  (`outputFileId`); the screen links to it and says so. `trim_spaces`, `remove_duplicates`, `normalize_dates` are the first
  operations; each new one needs a translation on the frontend.
- ✅ Profiling returns, per column, a detected type, a **meaning with a confidence** (the UI flags anything under 85%), counts of
  filled / empty / duplicate cells and a few sample values. Samples come from the user's file and are rendered as plain text.
- ✅ Operation parameters are validated by the server (`remove_duplicates` needs at least one key column, `normalize_dates`
  exactly one); the UI checks the same rule first. A workbook that is not `ready` answers **409** to a job.
- ❓ **Natural-language commands** ("find the rows where VAT is wrong") are not in this phase. They belong to the assistant (F10)
  and will call these same operations as tools.
- ✅ **Reconciliation compares a file that is `ready`.** The server must answer **422** for a file that is still processing, or is
  not a statement, so a half-read file can never be "reconciled" against nothing. The UI only offers ready files, but must
  not be the only line of defence.
- ✅ A row's `difference` and the summary's `differenceTotal` are computed by the server. The model **only suggests** a match;
  `confirm` / `reject` are made by a person, are allowed **once**, and only for a `suggested` row (**409** otherwise).
- ❓ Manual matching (pairing two unmatched rows by hand) is not in the contract yet.
- ✅ **Imports write nothing until committed.** `canCommit` is decided by the server and the button follows it: all required
  fields mapped, and not every row invalid. Bad rows are **reported and skipped**, not fatal. ❓ Confirm that policy.
- ✅ The mapping is the server's proposal first; a person may change it, which is saved with `PUT /imports/{id}/mapping`
  and answered with a fresh preview and errors. One file column may feed only one field.
- ✅ Committing cannot be undone from the UI, so it is confirmed first. ❓ Decide whether imported rows need a rollback and,
  per `BACKEND.md`, whether an import is subject to the approval workflow (F11).
- ❓ Lists (`/excel/workbooks`, `/reconciliations`, `/imports`) return plain arrays with no paging; add cursor paging before volume grows.
- ✅ `POST /exports/onec` builds a file of approved entries for 1C and returns a File (also listed under Files). ❓ The real 1C format
  and the choice of which entries are included belong to the backend and an accountant.
- ❓ New permission keys: `excel:write`, `reconciliation:read|write`, `integrations:read|write`.

## 10. Assistant (phase F10)

- ✅ **Sending a message** is `POST /conversations/{id}/messages` and answers with `text/event-stream`. Every event needs a
  numeric, increasing `id:`; the client ignores an event it has already seen. Requires an `Idempotency-Key` (a retried send must
  not ask the model twice).
- ✅ **Resume.** If the connection drops, the client calls `GET /messages/{id}/events` with `Last-Event-ID` and expects the
  missing events (then the rest). Keep generated events for a few minutes, even after the client disconnects.
- ✅ **Stop.** `POST /messages/{id}/stop` must really cancel generation (it costs money). The stopped message is stored with
  status `stopped` and the text written so far.
- ✅ **Stored copy wins.** When a stream ends the client re-reads `GET /conversations/{id}`; the stored messages must match what
  was streamed (same text, citations, tool runs, approvals).
- ✅ **Citations point at stored resources** (`legislation | news | file | invoice` + id), are checked against the caller's
  tenant and permissions, and the excerpt is the stored text. An answer to a legal question with no source must say so; the
  model must never be allowed to cite something that was not retrieved.
- ✅ **Retrieved text is untrusted** (prompt injection from uploaded files and news). The UI renders model output as sanitised
  Markdown without images, but the backend must still keep tool permissions independent of what the text says.
- ✅ **Writes go through approvals.** A tool with risk `write` creates an `Approval`; `POST /approvals/{id}/decide` answers
  **403** to the requester and to anyone without `approvals:decide`, and **409** if already decided. Never rely on the UI hiding buttons.
- ✅ Store `modelVersion` on every assistant message, and keep feedback (`up|down` + optional correction) linked to it: it is
  the training signal for `MODEL_TRAINING.md`.
- ❓ Rate limiting: answer **429** (`RATE_LIMITED`) when a user or company is over budget; the UI shows it as a failed answer.
- ❓ Attachments (`news`, `legislation`, `file`, `invoice`) are ids only; the server loads the content itself and re-checks access.
