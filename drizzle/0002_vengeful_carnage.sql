ALTER TABLE "ledger_entries" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "voided_by" text;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD COLUMN "reversal_of_id" uuid;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_reversal_of_id_ledger_entries_id_fk" FOREIGN KEY ("reversal_of_id") REFERENCES "public"."ledger_entries"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ledger_entries_reversal_of_idx" ON "ledger_entries" USING btree ("reversal_of_id");