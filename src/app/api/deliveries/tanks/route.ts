import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";

// GET /api/deliveries/tanks
// Returns שיווק transfer details that have been closed (status=סגירה) but not yet
// assigned to any delivery. Uses raw SQL because the DeliveryDetail.transferDetailId
// foreign key is added by a migration (npx prisma migrate dev) that may not have run yet.
// Falls back to an empty array if the column does not exist.
export async function GET(_req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  try {
    const rows = await prisma.$queryRaw<Array<{
      id: string;
      headerId: string;
      fishTypeName: string;
      totalWeightKg: number | null;
      fishCount: number | null;
      avgWeightGrams: number | null;
      destPondName: string;
      sourcePondName: string;
      tankCode: string | null;
      vehicleCode: string | null;
      transferDate: Date;
    }>>`
      SELECT
        ftd.id,
        ftd."headerId",
        COALESCE(fs."englishName", fs."latinName") AS "fishTypeName",
        ftd."totalWeightKg",
        ftd."fishCount",
        ftd."avgWeightGrams",
        dp."name"                AS "destPondName",
        sp."name"                AS "sourcePondName",
        t."code"                 AS "tankCode",
        tm."externalVehicleCode" AS "vehicleCode",
        fth."transferDate"
      FROM "FishTransferDetail" ftd
      JOIN "FishTransferHeader" fth ON fth.id = ftd."headerId"
      JOIN "FishStrain"         fs  ON fs.id  = ftd."fishStrainId"
      JOIN "Pond"               dp  ON dp.id  = ftd."destPondId"
      JOIN "Pond"               sp  ON sp.id  = fth."sourcePondId"
      LEFT JOIN "TransferMeans" tm  ON tm.id  = ftd."transferMeansId"
      LEFT JOIN "Tank"          t   ON t.id   = tm."internalTankId"
      LEFT JOIN "DeliveryDetail" dd ON dd."transferDetailId" = ftd.id
      WHERE fth."transferType" = 'שיווק'
        AND fth.status = 'הסתיימה'
        AND ftd.status = 'סגירה'
        AND dd.id IS NULL
      ORDER BY fth."transferDate" DESC
    `;

    const result = rows.map((r) => ({
      ...r,
      totalWeightKg: r.totalWeightKg ? Number(r.totalWeightKg) : null,
      fishCount: r.fishCount ? Number(r.fishCount) : null,
      avgWeightGrams: r.avgWeightGrams ? Number(r.avgWeightGrams) : null,
      transferDate: r.transferDate instanceof Date ? r.transferDate.toISOString() : r.transferDate,
    }));

    return NextResponse.json(result);
  } catch (e) {
    console.warn("[/api/deliveries/tanks] raw query failed (migration pending?):", e);
    return NextResponse.json([]);
  }
}
