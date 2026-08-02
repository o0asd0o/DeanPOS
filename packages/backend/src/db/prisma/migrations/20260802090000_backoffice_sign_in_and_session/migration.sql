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

-- Reuses the single `app.tenant_id` choke point (record 029) with a session
-- id as the scope value, rather than a second session variable — see this
-- issue's `## Comments` for the full reasoning and the reviewer's own look.
CREATE POLICY "session_self_lookup" ON "Session"
  FOR SELECT USING ("id" = current_setting('app.tenant_id', true));

-- UPDATE needs a row visible under a SELECT policy too, in addition to its
-- own USING clause (PostgreSQL RLS) — session_self_lookup alone only makes
-- a row visible by id, never by tenant, which session_tenant_update needs.
CREATE POLICY "session_tenant_select" ON "Session"
  FOR SELECT USING ("tenant_id" = current_setting('app.tenant_id', true));

CREATE POLICY "session_tenant_insert" ON "Session"
  FOR INSERT WITH CHECK ("tenant_id" = current_setting('app.tenant_id', true));

-- Two legitimate updaters: an ordinary tenant-scoped write (sign-out) and
-- the idle-refresh bump made inside the session_self_lookup transaction,
-- which never sets a real tenant id — hence the `OR`.
CREATE POLICY "session_tenant_update" ON "Session"
  FOR UPDATE USING (
    "tenant_id" = current_setting('app.tenant_id', true)
    OR "id" = current_setting('app.tenant_id', true)
  );

-- Same reuse applied to User, with the scope value an email instead of a
-- session id. Additive to "user_tenant_isolation" (Postgres ORs permissive
-- SELECT policies) — INSERT/UPDATE/DELETE stay governed by that policy alone.
CREATE POLICY "user_login_lookup" ON "User"
  FOR SELECT USING ("email" = current_setting('app.tenant_id', true));
