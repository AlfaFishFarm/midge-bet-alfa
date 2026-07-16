-- Add transferDetailId to DeliveryDetail so that שיווק transfer rows
-- can be linked to the delivery cert row that consumed them.
-- This column is already defined in schema.prisma; this migration creates it in the DB.

ALTER TABLE "DeliveryDetail" ADD COLUMN IF NOT EXISTS "transferDetailId" TEXT;

ALTER TABLE "DeliveryDetail"
  DROP CONSTRAINT IF EXISTS "DeliveryDetail_transferDetailId_fkey";

ALTER TABLE "DeliveryDetail"
  ADD CONSTRAINT "DeliveryDetail_transferDetailId_fkey"
  FOREIGN KEY ("transferDetailId") REFERENCES "FishTransferDetail"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
