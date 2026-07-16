-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "username" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" TEXT,
    "after" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "latinFirstName" TEXT,
    "latinLastName" TEXT,
    "nickname" TEXT,
    "language" TEXT DEFAULT 'עברית',
    "roleTitle" TEXT,
    "phone" TEXT,
    "phone2" TEXT,
    "email" TEXT,
    "email2" TEXT,
    "priorityEmployeeNo" TEXT,
    "userAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hireDate" TIMESTAMP(3),

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppModule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AppModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerRole" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "accessLevel" INTEGER NOT NULL DEFAULT 6,

    CONSTRAINT "WorkerRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishStrain" (
    "id" TEXT NOT NULL,
    "latinName" TEXT NOT NULL,
    "englishName" TEXT,
    "notes" TEXT,

    CONSTRAINT "FishStrain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "priorityProductId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "marketingStartDate" TIMESTAMP(3),
    "fishStrainId" TEXT,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishGrowthParameter" (
    "id" TEXT NOT NULL,
    "fishStrainId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "avgCycleLengthDays" INTEGER,
    "minWaterTemp" DOUBLE PRECISION,
    "maxWaterTemp" DOUBLE PRECISION,
    "minOxygen" DOUBLE PRECISION,
    "maxBiomassDensityKgPerDunam" DOUBLE PRECISION,
    "maxAdultDensityPerDunam" DOUBLE PRECISION,
    "maxFingerlingDensityPerDunam" DOUBLE PRECISION,
    "targetMarketWeightGrams" DOUBLE PRECISION,

    CONSTRAINT "FishGrowthParameter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopulationCode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,

    CONSTRAINT "PopulationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PondType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "PondType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pond" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "pondTypeId" TEXT NOT NULL,
    "volume" DOUBLE PRECISION,
    "areaDunam" DOUBLE PRECISION,
    "feeders" INTEGER,
    "spreaders" INTEGER,
    "electricity" INTEGER,
    "oxygenUnits" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "notes" TEXT,

    CONSTRAINT "Pond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tank" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Tank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowthCycle" (
    "id" TEXT NOT NULL,
    "priorityCycleCode" TEXT,
    "pondId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "openNotes" TEXT,
    "closeNotes" TEXT,

    CONSTRAINT "GrowthCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TankBind" (
    "id" TEXT NOT NULL,
    "dateTime" TIMESTAMP(3) NOT NULL,
    "tankType" TEXT NOT NULL,
    "tankId" TEXT,
    "externalTankRef" TEXT,
    "info" TEXT,

    CONSTRAINT "TankBind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferMeans" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "meansType" TEXT NOT NULL,
    "internalTankId" TEXT,
    "externalVehicleCode" TEXT,

    CONSTRAINT "TransferMeans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishTransferHeader" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "sourcePondId" TEXT NOT NULL,
    "transferType" TEXT NOT NULL,
    "transferDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'טיוטא',
    "notes" TEXT,

    CONSTRAINT "FishTransferHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishTransferDetail" (
    "id" TEXT NOT NULL,
    "headerId" TEXT NOT NULL,
    "transferMeansId" TEXT,
    "fishStrainId" TEXT NOT NULL,
    "fishCount" INTEGER,
    "avgWeightGrams" DOUBLE PRECISION,
    "destPondId" TEXT NOT NULL,
    "transferTime" TIMESTAMP(3),
    "populationCodeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'טיוטא',
    "notes" TEXT,

    CONSTRAINT "FishTransferDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeightType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "WeightType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishWeighingHeader" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "staffName" TEXT,
    "weightTypeId" TEXT NOT NULL,
    "tankId" TEXT,
    "transferDetailId" TEXT,
    "pondId" TEXT NOT NULL,
    "cycleId" TEXT,
    "notes" TEXT,

    CONSTRAINT "FishWeighingHeader_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FishWeighingBasketDetail" (
    "id" TEXT NOT NULL,
    "headerId" TEXT NOT NULL,
    "basketSeq" INTEGER NOT NULL,
    "emptyWetWeight" DOUBLE PRECISION NOT NULL,
    "weightWithFish" DOUBLE PRECISION NOT NULL,
    "fishCount" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "FishWeighingBasketDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowingStage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "GrowingStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrowingThreshold" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "growingStageId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "GrowingThreshold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactInfo" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "notes" TEXT,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "orderId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "driverName" TEXT,
    "vetApprovalRef" TEXT,
    "shipperName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'טיוטא',
    "pdfBlob" BYTEA,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryDetail" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "fishTypeDescription" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT,
    "grossNet" TEXT,
    "price" DOUBLE PRECISION,

    CONSTRAINT "DeliveryDetail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Translation" (
    "id" TEXT NOT NULL,
    "listName" TEXT NOT NULL,
    "tableName" TEXT NOT NULL,
    "fk" TEXT NOT NULL,
    "langCode" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Translation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_userAccountId_key" ON "Worker"("userAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AppModule_name_key" ON "AppModule"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerRole_workerId_roleId_moduleId_key" ON "WorkerRole"("workerId", "roleId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "PopulationCode_code_key" ON "PopulationCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PondType_name_key" ON "PondType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Pond_code_key" ON "Pond"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Tank_code_key" ON "Tank"("code");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthCycle_priorityCycleCode_key" ON "GrowthCycle"("priorityCycleCode");

-- CreateIndex
CREATE UNIQUE INDEX "GrowthCycle_pondId_openedAt_key" ON "GrowthCycle"("pondId", "openedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FishTransferHeader_cycleId_sourcePondId_transferDate_key" ON "FishTransferHeader"("cycleId", "sourcePondId", "transferDate");

-- CreateIndex
CREATE UNIQUE INDEX "WeightType_name_key" ON "WeightType"("name");

-- CreateIndex
CREATE UNIQUE INDEX "FishWeighingHeader_date_pondId_tankId_key" ON "FishWeighingHeader"("date", "pondId", "tankId");

-- CreateIndex
CREATE UNIQUE INDEX "FishWeighingBasketDetail_headerId_basketSeq_key" ON "FishWeighingBasketDetail"("headerId", "basketSeq");

-- CreateIndex
CREATE UNIQUE INDEX "GrowingStage_name_key" ON "GrowingStage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GrowingThreshold_productId_growingStageId_key" ON "GrowingThreshold"("productId", "growingStageId");

-- CreateIndex
CREATE UNIQUE INDEX "Translation_tableName_langCode_fk_key" ON "Translation"("tableName", "langCode", "fk");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Worker" ADD CONSTRAINT "Worker_userAccountId_fkey" FOREIGN KEY ("userAccountId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRole" ADD CONSTRAINT "WorkerRole_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRole" ADD CONSTRAINT "WorkerRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerRole" ADD CONSTRAINT "WorkerRole_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "AppModule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_fishStrainId_fkey" FOREIGN KEY ("fishStrainId") REFERENCES "FishStrain"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishGrowthParameter" ADD CONSTRAINT "FishGrowthParameter_fishStrainId_fkey" FOREIGN KEY ("fishStrainId") REFERENCES "FishStrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishGrowthParameter" ADD CONSTRAINT "FishGrowthParameter_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pond" ADD CONSTRAINT "Pond_pondTypeId_fkey" FOREIGN KEY ("pondTypeId") REFERENCES "PondType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowthCycle" ADD CONSTRAINT "GrowthCycle_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TankBind" ADD CONSTRAINT "TankBind_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferMeans" ADD CONSTRAINT "TransferMeans_internalTankId_fkey" FOREIGN KEY ("internalTankId") REFERENCES "Tank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferHeader" ADD CONSTRAINT "FishTransferHeader_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "GrowthCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferHeader" ADD CONSTRAINT "FishTransferHeader_sourcePondId_fkey" FOREIGN KEY ("sourcePondId") REFERENCES "Pond"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferDetail" ADD CONSTRAINT "FishTransferDetail_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "FishTransferHeader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferDetail" ADD CONSTRAINT "FishTransferDetail_transferMeansId_fkey" FOREIGN KEY ("transferMeansId") REFERENCES "TransferMeans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferDetail" ADD CONSTRAINT "FishTransferDetail_fishStrainId_fkey" FOREIGN KEY ("fishStrainId") REFERENCES "FishStrain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferDetail" ADD CONSTRAINT "FishTransferDetail_destPondId_fkey" FOREIGN KEY ("destPondId") REFERENCES "Pond"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishTransferDetail" ADD CONSTRAINT "FishTransferDetail_populationCodeId_fkey" FOREIGN KEY ("populationCodeId") REFERENCES "PopulationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingHeader" ADD CONSTRAINT "FishWeighingHeader_weightTypeId_fkey" FOREIGN KEY ("weightTypeId") REFERENCES "WeightType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingHeader" ADD CONSTRAINT "FishWeighingHeader_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "Tank"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingHeader" ADD CONSTRAINT "FishWeighingHeader_transferDetailId_fkey" FOREIGN KEY ("transferDetailId") REFERENCES "FishTransferDetail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingHeader" ADD CONSTRAINT "FishWeighingHeader_pondId_fkey" FOREIGN KEY ("pondId") REFERENCES "Pond"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingHeader" ADD CONSTRAINT "FishWeighingHeader_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "GrowthCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FishWeighingBasketDetail" ADD CONSTRAINT "FishWeighingBasketDetail_headerId_fkey" FOREIGN KEY ("headerId") REFERENCES "FishWeighingHeader"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowingThreshold" ADD CONSTRAINT "GrowingThreshold_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrowingThreshold" ADD CONSTRAINT "GrowingThreshold_growingStageId_fkey" FOREIGN KEY ("growingStageId") REFERENCES "GrowingStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryDetail" ADD CONSTRAINT "DeliveryDetail_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "Delivery"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

