import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withModuleAccess } from "@/lib/api-guard";
import { AccessLevel } from "@/lib/permissions";
import { writeAudit } from "@/lib/audit";

function getWorkerId(req: NextRequest): string {
  const segments = req.nextUrl.pathname.split("/");
  // path: /api/admin/workers/[id]/signature
  return decodeURIComponent(segments[segments.length - 2]);
}

/** GET /api/admin/workers/[id]/signature  — serve the signature image */
export async function GET(req: NextRequest) {
  const workerId = getWorkerId(req);
  const worker = await (prisma.worker as any).findUnique({
    where: { id: workerId },
    select: { digitalSignature: true },
  });
  if (!worker || !worker.digitalSignature) {
    return NextResponse.json({ error: "אין חתימה" }, { status: 404 });
  }

  const bytes: Buffer = worker.digitalSignature;
  // Detect image type from magic bytes
  let contentType = "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) contentType = "image/jpeg";
  else if (bytes[0] === 0x47 && bytes[1] === 0x49) contentType = "image/gif";
  else if (bytes[0] === 0x52 && bytes[1] === 0x49) contentType = "image/webp";

  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}

/** POST /api/admin/workers/[id]/signature  — upload / replace signature */
export const POST = withModuleAccess(
  "אדמיניסטרציה",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const workerId = getWorkerId(req);

    const existing = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!existing) {
      return NextResponse.json({ error: "עובד לא נמצא" }, { status: 404 });
    }

    let imageBytes: Buffer;
    try {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "לא נשלח קובץ" }, { status: 400 });
      }
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: "גודל הקובץ חייב להיות עד 2MB" }, { status: 413 });
      }
      const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];
      if (!allowed.includes(file.type)) {
        return NextResponse.json(
          { error: "סוג קובץ לא נתמך — יש להעלות PNG, JPEG או WEBP" },
          { status: 415 }
        );
      }
      const arrayBuf = await file.arrayBuffer();
      imageBytes = Buffer.from(arrayBuf);
    } catch {
      return NextResponse.json({ error: "שגיאה בקריאת הקובץ" }, { status: 400 });
    }

    await (prisma.worker as any).update({
      where: { id: workerId },
      data: { digitalSignature: imageBytes },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "Worker",
      entityId: workerId,
      before: { digitalSignature: (existing as any).digitalSignature ? "[exists]" : null },
      after: { digitalSignature: "[uploaded]" },
    });

    return NextResponse.json({ ok: true });
  }
);

/** DELETE /api/admin/workers/[id]/signature  — remove signature */
export const DELETE = withModuleAccess(
  "אדמיניסטרציה",
  AccessLevel.EXECUTIVE,
  async (req: NextRequest, { user }) => {
    const workerId = getWorkerId(req);

    const existing = await prisma.worker.findUnique({ where: { id: workerId } });
    if (!existing) {
      return NextResponse.json({ error: "עובד לא נמצא" }, { status: 404 });
    }

    await (prisma.worker as any).update({
      where: { id: workerId },
      data: { digitalSignature: null },
    });

    await writeAudit({
      userId: user.id,
      username: user.username,
      action: "update",
      entityType: "Worker",
      entityId: workerId,
      before: { digitalSignature: "[exists]" },
      after: { digitalSignature: null },
    });

    return NextResponse.json({ ok: true });
  }
);
