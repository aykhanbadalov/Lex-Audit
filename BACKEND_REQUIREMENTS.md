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
