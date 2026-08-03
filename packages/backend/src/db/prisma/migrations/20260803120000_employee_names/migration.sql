-- Additive only: both columns default to '' so every existing row is valid the
-- instant this runs. Rows created before this migration have no name on
-- record, and '' is that absence — the API requires a name on create from now
-- on, but never rewrites history to pretend one was given.
ALTER TABLE "User" ADD COLUMN "first_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN "last_name" TEXT NOT NULL DEFAULT '';
