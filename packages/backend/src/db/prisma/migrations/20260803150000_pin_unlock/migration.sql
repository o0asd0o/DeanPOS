-- Additive only (issue 10, record 057): the PIN's hash on User. Nullable, no
-- default, no backfill. The existing table-level grant on "User" already
-- covers UPDATE, so no new grant is needed.
ALTER TABLE "User" ADD COLUMN "pin_hash" TEXT;
