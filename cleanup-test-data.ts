import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dd = await prisma.deliveryDetail.deleteMany({});
  console.log("Deleted DeliveryDetails:", dd.count);

  const d = await prisma.delivery.deleteMany({});
  console.log("Deleted Deliveries:", d.count);

  const ftd = await prisma.fishTransferDetail.deleteMany({
    where: { header: { transferType: "שיווק" } },
  });
  console.log("Deleted Transfer Details (שיווק):", ftd.count);

  const fth = await prisma.fishTransferHeader.deleteMany({
    where: { transferType: "שיווק" },
  });
  console.log("Deleted Transfer Headers (שיווק):", fth.count);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
