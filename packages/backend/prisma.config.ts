import { defineConfig } from "prisma/config";

// Prisma 7 dropped `url` from the schema's datasource block, so the connection
// lives here. Only migrate/introspect read it — `prisma generate` runs without
// DATABASE_URI set (Docker build, fresh clone), hence the empty fallback.
export default defineConfig({
  schema: "src/db/prisma/schema.prisma",
  datasource: { url: process.env.DATABASE_URI ?? "" },
});
