/*
  Warnings:

  - A unique constraint covering the columns `[cycleId,sourcePondId,transferDate,transferType]` on the table `FishTransferHeader` will be added. If there are existing duplicate values, this will fail.
  - The unique index `FishTransferHeader_cycleId_sourcePondId_transferDate_key` will be dropped (it allowed only one transfer header per pond+date, regardless of transferType - which incorrectly merged e.g. a same-day דילול and תמותה into one header).

*/
-- DropIndex
DROP INDEX "FishTransferHeader_cycleId_sourcePondId_transferDate_key";

-- CreateIndex
CREATE UNIQUE INDEX "FishTransferHeader_cycleId_sourcePondId_transferDate_trans_key" ON "FishTransferHeader"("cycleId", "sourcePondId", "transferDate", "transferType");
