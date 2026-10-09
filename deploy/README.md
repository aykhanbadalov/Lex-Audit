# Deploying the frontend

1. Build for production: `pnpm build:prod`. It type-checks, builds with mocks switched off, and then runs `scripts/check-dist.mjs`,
   which **fails** if `mockServiceWorker.js`, demo accounts or demo passwords are in `dist/`, or if the first-load JavaScript and CSS
   grow past the budget.
2. Serve the contents of `dist/` as static files. `nginx.conf` is a working example: security headers, long caching for hashed
   assets, no caching for `index.html`, single-page fallback, and `/api` proxied to the backend with buffering off (needed for the
   assistant's streamed answers).
3. Never deploy a build made with `VITE_ENABLE_MSW=true`: the whole app would run on fake data. `pnpm build` (no `:prod`) is for
   local demos only.

Notes

- The CSP allows `style-src 'unsafe-inline'` because the UI libraries set inline `style` attributes. Scripts are `'self'` only.
  Review this if a library that needs `unsafe-eval` is ever added.
- `worker-src blob:` and `frame-src blob:` are for the PDF preview (pdf.js worker and the object URL of the document).
- Rolling out: upload `assets/` before `index.html`, so a user who still has the old page open can fetch the files it points to.
- The backend sets the refresh cookie (`HttpOnly; Secure; SameSite=Strict`); the frontend never reads or stores it.
