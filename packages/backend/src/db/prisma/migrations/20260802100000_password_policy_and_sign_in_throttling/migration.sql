-- CreateTable
CREATE TABLE "SignInThrottle" (
    "key"          TEXT NOT NULL,
    "failures"     INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInThrottle_pkey" PRIMARY KEY ("key")
);

-- Deliberately no RLS (record 033). This table has no tenant_id, no
-- user_id, no foreign key, and its rows exist for addresses that belong to
-- no account at all — a counter for nobody@example.com has no tenant to
-- belong to. The day it needs a tenant_id it needs a new record.
REVOKE ALL ON "SignInThrottle" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "SignInThrottle" TO "deanpos_app";
