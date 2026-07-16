import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

// Batch save for staged transfer-detail edits. Originally built for the תמותה screen
// (spec page 19/39-40, item #8 — Dean approved "build fully per spec" 2026-06-29), whose
// rowPayloadSchema below this endpoint still validates creates/updates against.
//
// Spec text for קניה (p.36-37), דילול/פירוק (p.37-38, shared spec) and שיווק (p.38,
// "כל המפרט זהה לזה של דילול ופירוק") independently describes the same deferred-commit
// rule for row DELETION: "מחיקת שורות... יתבצע רק בעת שמירת ההעברה" — clicking delete
// only removes the row from the screen/recalculates the summary; the actual DB delete
// happens only when the transfer is saved. The HTML prototype's tfRows/tfDelRow (pure
// in-memory splice, no per-click network call) confirms the same model. Unlike תמותה,
// these four types keep row ADD as an immediate POST (so the weighing screen can attach
// to an already-persisted detailId for דילול/פירוק/שיווק) — only DELETE is deferred.
// So non-תמותה callers send deleteIds-only batches; creates/updates stay תמותה-only.
//
// Everything happens inside one prisma.$transaction so a half-valid batch never
// partially lands — either the whole save succeeds, or none of it does.

const rowPayloadSchema = z.object({
  fishStrainId: z.string().min(1),
  destPondId: z.string().min(1),
  fishCount: z.number().int().positive(),
  avgWeightGrams: z.number().positive(),
  transferTime: z.string().min(1),
  notes: z.string().min(1),
});

const batchSchema = z.object({
  creates: z.array(rowPayloadSchema),
  updates: z.array(rowPayloadSchema.extend({ id: z.string().min(1) })),
  deleteIds: z.array(z.string().min(1)),
});

function getHeaderId(req: NextRequest) {
  const segments = req.nextUrl.pathname.split("/");
  // .../api/transfers/<headerId>/details/batch
  return segments[segments.length - 3];
}

export const POST = withModuleAccess(
  "תפעול",
  AccessLevel.OPERATIONS,
  async (req: NextRequest, { user }) => {
    const headerId = getHeaderId(req);
    const body = await req.json().catch(() => null);
    const parsed = batchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
    }
    const { creates, updates, deleteIds } = parsed.data;

    const header = await prisma.fishTransferHeader.findUnique({ where: { id: headerId } });
    if (!header) return NextResponse.json({ error: "העברה לא נמצאה" }, { status: 404 });
    if (header.transferType !== "תמותה" && (creates.length > 0 || updates.length > 0)) {
      return NextResponse.json(
        { error: "יצירה/עדכון באצווה נתמכים כרגע רק לדיווחי תמותה — סוגי העברה אחרים תומכים רק במחיקה דחויה" },
        { status: 422 }
      );
    }
    if (header.status === "הסתיימה") {
      return NextResponse.json({ error: "לא ניתן לעדכן דיווח שהסתיים" }, { status: 409 });
    }

    // Block deleting any row that already has a weighing attached — same rule as the
    // single-row DELETE endpoint (details/[detailId]/route.ts).
    if (deleteIds.length > 0) {
      const toDelete = await prisma.fishTransferDetail.findMany({
        where: { id: { in: deleteIds } },
        include: { weighings: { select: { id: true } } },
      });
      const blocked = toDelete.find((d) => d.weighings.length > 0);
      if (blocked) {
        return NextResponse.json(
          { error: "לא ניתן למחוק שורה שיש לה שקילות — מחק את השקילות תחילה" },
          { status: 409 }
        );
      }
      const foreign = toDelete.find((d) => d.headerId !== headerId);
      if (foreign || toDelete.length !== deleteIds.length) {
        return NextResponse.json({ error: "שורה למחיקה לא נמצאה" }, { status: 404 });
      }
    }

    // Validate ownership of update targets up front, before the transaction, so a bad
    // id fails fast with a clear error rather than mid-transaction.
    if (updates.length > 0) {
      const existing = await prisma.fishTransferDetail.findMany({
        where: { id: { in: updates.map((u) => u.id) } },
      });
      const foreign = existing.find((d) => d.headerId !== headerId);
      if (foreign || existing.length !== updates.length) {
        return NextResponse.json({ error: "שורה לעדכון לא נמצאה" }, { status: 404 });
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        const createdRows = [];
        for (const c of creates) {
          const row = await tx.fishTransferDetail.create({
            data: {
              headerId,
              fishStrainId: c.fishStrainId,
              destPondId: c.destPondId,
              fishCount: c.fishCount,
              avgWeightGrams: c.avgWeightGrams,
              transferTime: new Date(c.transferTime),
              notes: c.notes,
              status: "טיוטא",
            },
          });
          createdRows.push(row);
        }

        const updatedRows: { before: unknown; after: unknown }[] = [];
        for (const u of updates) {
          const before = await tx.fishTransferDetail.findUniqueOrThrow({ where: { id: u.id } });
          const after = await tx.fishTransferDetail.update({
            where: { id: u.id },
            data: {
              fishStrainId: u.fishStrainId,
              destPondId: u.destPondId,
              fishCount: u.fishCount,
              avgWeightGrams: u.avgWeightGrams,
              transferTime: new Date(u.transferTime),
              notes: u.notes,
            },
          });
          updatedRows.push({ before, after });
        }

        let deletedRows: unknown[] = [];
        if (deleteIds.length > 0) {
          deletedRows = await tx.fishTransferDetail.findMany({ where: { id: { in: deleteIds } } });
          await tx.fishTransferDetail.deleteMany({ where: { id: { in: deleteIds }, headerId } });
        }

        return { createdRows, updatedRows, deletedRows };
      });

      // Audit logging happens after the transaction commits — write one entry per
      // affected row, mirroring the granularity of the existing single-row endpoints.
      for (const row of result.createdRows) {
        await writeAudit({
          userId: user.id,
          username: user.username,
          action: "create",
          entityType: "FishTransferDetail",
          entityId: row.id,
          after: row,
        });
      }
      for (const { before, after } of result.updatedRows) {
        await writeAudit({
          userId: user.id,
          username: user.username,
          action: "update",
          entityType: "FishTransferDetail",
          entityId: (after as { id: string }).id,
          before,
          after,
        });
      }
      for (const row of result.deletedRows as { id: string }[]) {
        await writeAudit({
          userId: user.id,
          username: user.username,
          action: "delete",
          entityType: "FishTransferDetail",
          entityId: row.id,
          before: row,
        });
      }

      return NextResponse.json({
        ok: true,
        created: result.createdRows.length,
        updated: result.updatedRows.length,
        deleted: result.deletedRows.length,
      });
    } catch {
      return NextResponse.json({ error: "שגיאה בשמירת הדיווח — לא בוצעו שינויים" }, { status: 500 });
    }
  }
);
