-- Make clientId nullable on Delivery so "לקוח מזדמן" deliveries work without a DB client record.
ALTER TABLE "Delivery" ALTER COLUMN "clientId" DROP NOT NULL;
