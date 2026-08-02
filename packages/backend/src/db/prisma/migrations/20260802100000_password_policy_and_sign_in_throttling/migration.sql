-- CreateTable
CREATE TABLE "SignInThrottle" (
    "key"          TEXT NOT NULL,
    "failures"     INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignInThrottle_pkey" PRIMARY KEY ("key")
);

-- Deliberately no RLS: no tenant_id, no user_id, no foreign key — a row can
-- belong to no account at all. See .scratch/decisions/033-throttling-sign-in.md.
REVOKE ALL ON "SignInThrottle" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE, DELETE ON "SignInThrottle" TO "deanpos_app";
