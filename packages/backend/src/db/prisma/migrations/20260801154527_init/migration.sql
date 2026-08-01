-- CreateTable
CREATE TABLE "Ping" (
    "id" SERIAL NOT NULL,
    "message" TEXT NOT NULL DEFAULT 'pong',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ping_pkey" PRIMARY KEY ("id")
);

-- Seed the single row area 04 reads through Kysely.
INSERT INTO "Ping" ("message") VALUES ('pong');
