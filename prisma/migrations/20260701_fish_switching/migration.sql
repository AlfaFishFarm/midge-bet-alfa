-- CreateTable: fish_switching
-- Links a transfer-detail row to a fish-strain identity change event.
-- Spec page 42: "אם בחר להחליף לדג אחר מתוך רשימת הדגים שכן נמצאים בבריכה
-- אז יש לעדכן בטבלת fishSwitching על פעולת החלפת זהות של דגים".
-- Records are never standalone — they are cascade-deleted when the parent
-- FishTransferDetail row is deleted.

CREATE TABLE "fish_switching" (
    "id"               TEXT NOT NULL,
    "transferDetailId" TEXT NOT NULL,
    "fromStrainId"     TEXT NOT NULL,
    "toStrainId"       TEXT NOT NULL,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fish_switching_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey: fish_switching.transferDetailId -> FishTransferDetail.id
-- Cascade delete: per spec p.42, if the action row is deleted, its switch record must be deleted first/cascade.
ALTER TABLE "fish_switching"
    ADD CONSTRAINT "fish_switching_transferDetailId_fkey"
    FOREIGN KEY ("transferDetailId")
    REFERENCES "FishTransferDetail"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: fish_switching.fromStrainId -> FishStrain.id
ALTER TABLE "fish_switching"
    ADD CONSTRAINT "fish_switching_fromStrainId_fkey"
    FOREIGN KEY ("fromStrainId")
    REFERENCES "FishStrain"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey: fish_switching.toStrainId -> FishStrain.id
ALTER TABLE "fish_switching"
    ADD CONSTRAINT "fish_switching_toStrainId_fkey"
    FOREIGN KEY ("toStrainId")
    REFERENCES "FishStrain"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
