FROM oven/bun:1.3.13-slim AS build
WORKDIR /app
COPY . .
# vite-plus's prepare hook makes an HTTPS request; the slim base has no CA bundle.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
RUN bun run vp exec -F landing next build

FROM node:24.13.0-slim
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-landing" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/apps/landing/.next/standalone ./
COPY --from=build /app/apps/landing/.next/static ./apps/landing/.next/static
COPY --from=build /app/apps/landing/public ./apps/landing/public
EXPOSE 3000
CMD ["node", "apps/landing/server.js"]
