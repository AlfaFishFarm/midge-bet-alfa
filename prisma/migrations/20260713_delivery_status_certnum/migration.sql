-- Add certNumber to Delivery (DC-YYYYMMDD-NNN format, set on finalize)
ALTER TABLE "Delivery" ADD COLUMN "certNumber" TEXT;

-- Add sourcePondName to DeliveryDetail (free-text for manual mode rows)
ALTER TABLE "DeliveryDetail" ADD COLUMN "sourcePondName" TEXT;
