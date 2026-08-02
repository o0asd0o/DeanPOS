-- Global email uniqueness (issue 03) — see the issue's `## Comments`.
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_tenant_id_idx" ON "Session"("tenant_id");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Revocation is a column (`revoked_at`), never a delete — no DELETE grant.
REVOKE ALL ON "Session" FROM "deanpos_app";
GRANT SELECT, INSERT, UPDATE ON "Session" TO "deanpos_app";

ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" FORCE ROW LEVEL SECURITY;

-- Pre-auth has no tenant yet, so the lookup key travels on its own variable
-- and `app.tenant_id` stays unset — every tenant-keyed policy in the schema
-- then compares against nothing and denies. See .scratch/decisions/031.
CREATE POLICY "session_self_lookup" ON "Session"
  FOR SELECT USING ("id" = nullif(current_setting('app.session_id', true), ''));

-- Ordinary tenant isolation, unrelated to the pre-auth policy above. UPDATE
-- also applies SELECT policies when it reads a column (its WHERE), so this is
-- what makes touch-session's and revoke-session's rows visible to them.
CREATE POLICY "session_tenant_select" ON "Session"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));

CREATE POLICY "session_tenant_insert" ON "Session"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

CREATE POLICY "session_tenant_update" ON "Session"
  FOR UPDATE USING ("tenant_id" = current_setting('app.tenant_id', true));

-- Sign-in's one-row read, keyed on the globally-unique email. Permissive, so
-- it is OR-ed with "user_tenant_isolation" — which is exactly why it must key
-- on a variable that is never set in a tenant-scoped transaction.
CREATE POLICY "user_login_lookup" ON "User"
  FOR SELECT USING ("email" = nullif(current_setting('app.login_email', true), ''));
