# Deploying the frontend

Two kinds of build, one image (`Dockerfile`, nginx serving the static files):

|                 | `APP_MODE=demo`                                           | `APP_MODE=prod` (default)       |
| --------------- | --------------------------------------------------------- | ------------------------------- |
| Data            | built-in sample data in the browser (MSW), banner says so | the real backend through `/api` |
| Needs a backend | no                                                        | yes (`BACKEND_URL`)             |
| Use for         | showing the product, UI review                            | production                      |
| Script          | `pnpm build:demo`                                         | `pnpm build:prod`               |

```bash
# Demo: works anywhere, no backend
docker build -t lexaudit-web:demo --build-arg APP_MODE=demo .
docker run -p 8080:80 lexaudit-web:demo              # sign in: muhasib@lexaudit.test / demo1234

# Production: nginx proxies /api to the backend
docker build -t lexaudit-web .
docker run -p 80:80 -e BACKEND_URL=http://backend:8080 -e DNS_RESOLVER=127.0.0.11 lexaudit-web
```

`DNS_RESOLVER` is the DNS server nginx uses to find the backend (Docker: `127.0.0.11`; Kubernetes: the cluster DNS address).
`GET /healthz` answers `ok` for load balancer checks.

## What the build refuses to do

`pnpm build:prod` type-checks, builds with mocks switched off, then runs `scripts/check-dist.mjs`, which **fails** if
`mockServiceWorker.js`, demo accounts or demo passwords are in `dist/`, or if the first-load JavaScript and CSS grow past the
budget. A production image therefore cannot carry fake data by accident. `pnpm build` (no suffix) is for local work only.

## Checks before releasing

- `pnpm e2e:demo` smoke-tests the built demo bundle (serve `dist/` with `vite preview`).
- `pnpm e2e:real` signs in against a real backend on `localhost:8080` (see `INTEGRATION.md`).
- `nginx` security headers are in `default.conf.template`: CSP (scripts `'self'` only), HSTS, `nosniff`, `Referrer-Policy`,
  `Permissions-Policy`. `style-src 'unsafe-inline'` is there because the UI libraries set inline `style` attributes.
  `worker-src`/`frame-src blob:` are for the PDF preview.

## Rolling out

- Terminate TLS before this container (load balancer or ingress). The backend sets the refresh cookie as
  `HttpOnly; Secure; SameSite=Strict` on `/api/v1/auth`, which only works when the browser sees one origin: keep the frontend
  and `/api` on the same host name.
- Upload `assets/` before `index.html` when you publish by hand, so users with the old page open can still fetch their files.

## Vercel (demo)

`vercel.json` builds the demo (`pnpm build:demo`), serves `dist/`, falls back to `index.html` for every screen and sets the same
security headers. Import the repository in Vercel with the **repository root as the project root** (when only the frontend is in the
repository) or set *Root Directory* to `frontend` (when it is the whole monorepo). No environment variables are needed.
A real backend cannot sit behind Vercel's static hosting; for production use the Docker image above.
