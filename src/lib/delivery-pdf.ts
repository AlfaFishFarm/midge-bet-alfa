import { prisma } from "@/lib/db";
import { buildCertificateHtml } from "@/lib/certificate-html";

// Server-side PDF generation for delivery certificates (Node runtime only).
// Extracted from app/api/deliveries/[id]/pdf/route.ts on 2026-07-19 so the
// finalize route can also generate + store the PDF as a BLOB at הפקה time —
// spec p32: "יש לשמור את תעודת המשלוח בבסיס הנתונים כ-BLOB". Once stored, the
// certificate is frozen: later template/signature/data changes never alter
// what was actually issued to the client.

export async function generateDeliveryPdf(deliveryId: string): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const delivery = await (prisma.delivery as any).findUnique({
    where: { id: deliveryId },
    include: { client: true, details: true, carrier: true },
  });
  if (!delivery) throw new Error("תעודה לא נמצאה");
  if (delivery.status !== "הופק") throw new Error("ניתן להפיק PDF רק לתעודות שהופקו");

  // Fetch manager + producer workers (with digitalSignature)
  const workerIds = [delivery.managerId, delivery.producerWorkerId].filter(Boolean) as string[];
  const workersWithSig = workerIds.length
    ? await prisma.$queryRaw<
        Array<{ id: string; firstName: string; lastName: string; digitalSignature: Buffer | null }>
      >`SELECT id, "firstName", "lastName", "digitalSignature" FROM "Worker" WHERE id = ANY(${workerIds})`
    : [];

  const getWorkerName = (wid: string | null) => {
    if (!wid) return "—";
    const w = workersWithSig.find((x) => x.id === wid);
    return w ? [w.firstName, w.lastName].filter(Boolean).join(" ") : "—";
  };

  const dateStr = delivery.date instanceof Date
    ? delivery.date.toISOString().slice(0, 10)
    : String(delivery.date).slice(0, 10);
  const dateFormatted = new Date(dateStr + "T00:00:00").toLocaleDateString("he-IL", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });

  // Embed signature as base64 so Puppeteer doesn't need an authenticated request
  const managerWorker = workersWithSig.find((w) => w.id === delivery.managerId);
  let managerSigDataUrl: string | undefined;
  if (managerWorker?.digitalSignature) {
    const buf = Buffer.from(managerWorker.digitalSignature);
    let mime = "image/png";
    if (buf[0] === 0xff && buf[1] === 0xd8) mime = "image/jpeg";
    else if (buf[0] === 0x47 && buf[1] === 0x49) mime = "image/gif";
    else if (buf[0] === 0x52 && buf[1] === 0x49) mime = "image/webp";
    managerSigDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
  }

  // Company stamp — load from public/stamp.png if present
  let stampDataUrl: string | undefined;
  try {
    const { readFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const stampPath = join(process.cwd(), "public", "stamp.png");
    if (existsSync(stampPath)) {
      const stampBytes = readFileSync(stampPath);
      stampDataUrl = `data:image/png;base64,${stampBytes.toString("base64")}`;
    }
  } catch { /* no stamp — skip */ }

  const html = buildCertificateHtml({
    certNum: delivery.certNumber ?? "—",
    dateFormatted,
    loadingTime: delivery.loadingTime ?? "",
    clientDisplayName: delivery.clientName || delivery.client?.name || "—",
    clientContact: delivery.client?.contactInfo ?? "—",
    orderRef: delivery.orderRef ?? "",
    producerName: getWorkerName(delivery.producerWorkerId),
    driverDisplay: delivery.driverName || delivery.carrier?.name || "—",
    plateDisplay: delivery.carrier?.licensePlate ?? "—",
    vetApprovalRef: delivery.vetApprovalRef ?? "",
    notes: delivery.notes ?? "",
    managerName: getWorkerName(delivery.managerId),
    managerId: delivery.managerId ?? "",
    managerHasSig: !!(managerWorker?.digitalSignature),
    managerSigDataUrl,
    stampDataUrl,
    details: (delivery.details ?? []).map(
      (d: { transferDetailId?: string | null; fishTypeDescription: string; sourcePondName?: string | null; quantity: number }) => ({
        transferDetailId: d.transferDetailId,
        fishTypeDescription: d.fishTypeDescription,
        sourcePondName: d.sourcePondName,
        quantity: d.quantity,
      })
    ),
  });

  const { existsSync } = await import("fs");

  let executablePath: string;
  let chromiumArgs: string[];
  const isProduction = process.env.NODE_ENV === "production" || !!process.env.FORCE_CHROMIUM;

  if (isProduction) {
    const chromiumMod = await import("@sparticuz/chromium");
    executablePath = await chromiumMod.default.executablePath();
    chromiumArgs = chromiumMod.default.args;
  } else {
    const localPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/usr/bin/google-chrome-stable",
      "/usr/bin/google-chrome",
      "/usr/bin/chromium-browser",
      "/usr/bin/chromium",
    ];
    const found = localPaths.find((p) => existsSync(p));
    if (found) {
      executablePath = found;
      chromiumArgs = ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"];
    } else {
      const chromiumMod = await import("@sparticuz/chromium");
      executablePath = await chromiumMod.default.executablePath();
      chromiumArgs = chromiumMod.default.args;
    }
  }

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.launch({
    args: chromiumArgs,
    defaultViewport: { width: 1280, height: 800 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load", timeout: 30000 });
    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", bottom: "12mm", left: "10mm", right: "10mm" },
    });
    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}

/**
 * Generate the PDF and persist it to `Delivery.pdfBlob` (spec p32 BLOB rule).
 * Returns the buffer. Throws on generation failure — callers decide whether
 * that failure should block their own flow.
 */
export async function generateAndStoreDeliveryPdf(deliveryId: string): Promise<Buffer> {
  const pdf = await generateDeliveryPdf(deliveryId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (prisma.delivery as any).update({
    where: { id: deliveryId },
    data: { pdfBlob: pdf },
  });
  return pdf;
}
