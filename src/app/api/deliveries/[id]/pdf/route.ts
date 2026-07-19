import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { generateAndStoreDeliveryPdf } from "@/lib/delivery-pdf";

// Must run in Node.js runtime (not Edge) for Puppeteer
export const runtime = "nodejs";
// Allow up to 60 seconds for PDF generation
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { id } = await params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delivery = await (prisma.delivery as any).findUnique({
    where: { id },
    select: { id: true, status: true, certNumber: true, pdfBlob: true },
  });

  if (!delivery) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });
  if (delivery.status !== "הופק") {
    return NextResponse.json({ error: "ניתן להפיק PDF רק לתעודות שהופקו" }, { status: 400 });
  }

  const certNum = delivery.certNumber ?? id;
  const encodedFilename = encodeURIComponent(`תעודת-משלוח-${certNum}.pdf`);
  const pdfHeaders = {
    "Content-Type": "application/pdf",
    "Content-Disposition": `inline; filename="delivery-${certNum}.pdf"; filename*=UTF-8''${encodedFilename}`,
    "Cache-Control": "private, max-age=60",
  };

  // Spec p32: the certificate PDF is stored as a BLOB at הפקה — the stored copy
  // is the FROZEN issued document and is always served as-is. Never regenerate
  // over an existing blob: template/data changes must not alter an issued cert.
  if (delivery.pdfBlob) {
    return new NextResponse(Buffer.from(delivery.pdfBlob), { status: 200, headers: pdfHeaders });
  }

  // No stored blob (finalize-time generation failed, or cert predates the BLOB
  // rule) — generate now, store, and serve. From this point on it's frozen.
  try {
    const pdfBuffer = await generateAndStoreDeliveryPdf(id);
    return new NextResponse(pdfBuffer, { status: 200, headers: pdfHeaders });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[PDF] generation error:", message);
    const body = process.env.NODE_ENV === "production"
      ? { error: "שגיאה ביצירת PDF — נסה שנית" }
      : { error: message };
    return NextResponse.json(body, { status: 500 });
  }
}
