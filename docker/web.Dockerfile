FROM oven/bun:1.3.13-slim AS build
WORKDIR /app
COPY . .
# vite-plus's prepare hook makes an HTTPS request; the slim base has no CA bundle.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
ARG APP_DOMAIN=deanpos.localhost
ENV VITE_API_URL=https://api.${APP_DOMAIN}
RUN bun run vp run -F pos build && bun run vp run -F backoffice build

FROM caddy:2.11.4-alpine
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-web" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
COPY --from=build /app/apps/pos/dist /srv/pos
COPY --from=build /app/apps/backoffice/dist /srv/admin
COPY docker/Caddyfile /etc/caddy/Caddyfile
