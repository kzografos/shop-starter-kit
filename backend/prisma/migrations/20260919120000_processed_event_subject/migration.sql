-- ProcessedEvent is the Infrastructure webhook ledger; the row it refers to is
-- whatever the event was about, not necessarily an order (ARCHITECTURE-BLUEPRINT
-- §9: `orderId` → generic `subjectId`). Rename the column and widen it to text so
-- a provider reference that is not a UUID can be recorded. Nothing reads the
-- column (the primary key on event_id is the idempotency guard); the rename and
-- the uuid → text cast keep every existing value.

-- AlterTable
ALTER TABLE "processed_events" RENAME COLUMN "order_id" TO "subject_id";
ALTER TABLE "processed_events" ALTER COLUMN "subject_id" TYPE TEXT USING "subject_id"::text;
