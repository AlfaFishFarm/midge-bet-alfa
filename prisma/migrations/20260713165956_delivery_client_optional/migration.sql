-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_clientId_fkey";

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
