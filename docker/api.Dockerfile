FROM oven/bun:1.3.13-slim
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.title="deanpos-api" \
      org.opencontainers.image.revision="${IMAGE_TAG}"
WORKDIR /app
COPY . .
# vite-plus's prepare hook makes an HTTPS request; the slim base has no CA bundle.
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN bun install --frozen-lockfile
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "apps/api/src/index.ts"]
