ALTER TABLE "entries" ADD COLUMN "published_revision_id" uuid;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "first_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "last_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entries" ADD COLUMN "projection_state" text DEFAULT 'clean' NOT NULL;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_published_revision_id_revisions_id_fk" FOREIGN KEY ("published_revision_id") REFERENCES "public"."revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_projection_state_check" CHECK ("entries"."projection_state" in ('clean', 'dirty'));