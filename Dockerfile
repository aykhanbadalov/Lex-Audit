# syntax=docker/dockerfile:1
# APP_MODE=prod  -> real build, mocks removed, talks to the backend (BACKEND_URL)
# APP_MODE=demo  -> the whole app on built-in sample data, no backend needed (clearly marked with a banner)
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG APP_MODE=prod
RUN if [ "$APP_MODE" = "demo" ]; then pnpm build:demo; else pnpm build:prod; fi

FROM nginx:1.27-alpine
COPY deploy/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV BACKEND_URL=http://backend:8080 DNS_RESOLVER=127.0.0.11
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1/healthz || exit 1
