-- The runtime role's least-privilege grants (design D3, I6). The role itself
-- is created by scripts/ensure-runtime-role.ts before migrations run, because
-- a migration cannot name a role that does not exist yet. Postgres 15 and
-- later give PUBLIC no right to create objects in `public`, so `cms_runtime`
-- cannot run DDL with these grants alone.
GRANT USAGE ON SCHEMA public TO cms_runtime;
--> statement-breakpoint

-- The app reads, inserts and updates entries (a slug move is an UPDATE).
GRANT SELECT, INSERT, UPDATE ON TABLE entries TO cms_runtime;
--> statement-breakpoint

-- Revisions are append-only: no UPDATE and no DELETE, ever (design D3).
GRANT SELECT, INSERT ON TABLE revisions TO cms_runtime;
