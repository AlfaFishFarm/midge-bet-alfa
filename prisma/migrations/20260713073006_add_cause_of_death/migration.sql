/*
  Warnings:

  - You are about to drop the column `orderId` on the `Delivery` table. All the data in the column will be lost.
  - You are about to drop the column `shipperName` on the `Delivery` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `DeliveryDetail` table. All the data in the column will be lost.
  - You are about to drop the `Order` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Delivery" DROP CONSTRAINT "Delivery_orderId_fkey";

-- DropForeignKey
ALTER TABLE "Order" DROP CONSTRAINT "Order_clientId_fkey";

-- AlterTable
ALTER TABLE "Delivery" DROP COLUMN "orderId",
DROP COLUMN "shipperName",
ADD COLUMN     "carrierId" TEXT,
ADD COLUMN     "loadingTime" TEXT,
ADD COLUMN     "managerId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "producerWorkerId" TEXT;

-- AlterTable
ALTER TABLE "DeliveryDetail" DROP COLUMN "price",
ADD COLUMN     "transferDetailId" TEXT;

-- AlterTable
ALTER TABLE "FishTransferDetail" ADD COLUMN     "causeOfDeath" TEXT;

-- AlterTable
ALTER TABLE "Worker" ADD COLUMN     "digitalSignature" BYTEA;

-- DropTable
DROP TABLE "Order";

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_producerWorkerId_fkey" FOREIGN KEY ("producerWorkerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Worker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_carrierId_fkey" FOREIGN KEY ("carrierId") REFERENCES "Carrier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDetail" ADD CONSTRAINT "DeliveryDetail_transferDetailId_fkey" FOREIGN KEY ("transferDetailId") REFERENCES "FishTransferDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "FishTransferHeader_cycleId_sourcePondId_transferDate_trans_key" RENAME TO "FishTransferHeader_cycleId_sourcePondId_transferDate_transf_key";
