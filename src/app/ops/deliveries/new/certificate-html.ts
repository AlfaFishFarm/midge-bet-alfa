// Pure TypeScript (no JSX) — HTML string builder for the delivery certificate print window.
// Kept in a .ts file so the TSX parser doesn't choke on the HTML tags inside template literals.

export interface CertificateData {
  certNum: string;
  dateFormatted: string;
  loadingTime: string;
  clientDisplayName: string;
  clientContact: string;
  orderRef: string;
  producerName: string;
  driverDisplay: string;
  plateDisplay: string;
  vetApprovalRef: string;
  notes: string;
  managerName: string;
  managerId: string;
  managerHasSig: boolean;
  details: Array<{
    transferDetailId?: string | null;
    fishTypeDescription: string;
    sourcePondName?: string | null;
    quantity: number;
  }>;
}

export function buildCertificateHtml(d: CertificateData): string {
  const totalWeight = d.details.reduce((s, r) => s + (r.quantity || 0), 0);

  const rowsHtml = d.details.map((r, i) => [
    "<tr>",
    "<td style='padding:7px 10px;border-bottom:1px solid #eef5f2;color:#9abaa8;'>" + (i + 1) + "</td>",
    "<td style='padding:7px 10px;border-bottom:1px solid #eef5f2;'>" + (r.transferDetailId ?? "—") + "</td>",
    "<td style='padding:7px 10px;border-bottom:1px solid #eef5f2;'>" + r.fishTypeDescription + "</td>",
    "<td style='padding:7px 10px;border-bottom:1px solid #eef5f2;'>" + (r.sourcePondName ?? "—") + "</td>",
    "<td style='padding:7px 10px;border-bottom:1px solid #eef5f2;text-align:center;font-weight:700;'>" + (r.quantity || 0).toFixed(1) + "</td>",
    "</tr>",
  ].join("")).join("");

  const sigHtml = d.managerHasSig && d.managerId
    ? "<img src='/api/admin/workers/" + d.managerId + "/signature' alt='חתימה' style='max-height:56px;max-width:160px;object-fit:contain;' />"
    : "<div style='height:48px;'></div>";

  const notesSection = d.notes
    ? "<div style='margin-top:12px;'><div style='font-size:10px;color:#7a9a8a;margin-bottom:3px;'>הערות</div><div style='font-size:13px;font-weight:500;padding:6px 10px;background:#f7fbf9;border:1px solid #c8e0d8;border-radius:6px;'>" + d.notes + "</div></div>"
    : "";

  const orderRefSection = d.orderRef
    ? "<div><div style='font-size:10px;color:#7a9a8a;margin-bottom:3px;'>מספר הזמנה</div><div style='font-size:13px;font-weight:500;padding:6px 10px;background:#f7fbf9;border:1px solid #c8e0d8;border-radius:6px;'>" + d.orderRef + "</div></div>"
    : "<div></div>";

  const today = new Date().toLocaleDateString("he-IL");

  return [
    "<!DOCTYPE html>",
    "<html dir='rtl' lang='he'>",
    "<head>",
    "<meta charset='UTF-8'>",
    "<title>תעודת משלוח " + d.certNum + "</title>",
    "<link href='https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700&display=swap' rel='stylesheet'>",
    "<style>",
    "*{box-sizing:border-box;margin:0;padding:0;}",
    "body{font-family:Heebo,Arial,sans-serif;background:#f0f4f2;padding:20px;color:#2d3d35;direction:rtl;}",
    ".doc{background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,0.08);max-width:860px;margin:0 auto;}",
    ".doc-header{padding:1.4rem 2rem 1.1rem;border-bottom:3px solid #1D9E75;display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;}",
    ".doc-title{font-size:22px;font-weight:600;color:#1D9E75;text-align:center;margin-bottom:10px;letter-spacing:.5px;}",
    ".meta-row{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin-bottom:5px;}",
    ".badge{font-size:13px;font-weight:600;color:#0F6E56;background:#e1f5ee;padding:3px 12px;border-radius:5px;min-width:65px;text-align:center;}",
    ".section{padding:.9rem 2rem;border-bottom:1px solid #e8f0ec;}",
    ".sec-title{font-size:11px;font-weight:700;color:#0F6E56;text-transform:uppercase;letter-spacing:.8px;margin-bottom:10px;border-right:3px solid #1D9E75;padding-right:8px;}",
    ".grid-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;}",
    ".grid-4{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;}",
    ".field-lbl{font-size:10px;color:#7a9a8a;margin-bottom:3px;}",
    ".field-val{font-size:13px;font-weight:500;color:#2d3d35;padding:6px 10px;background:#f7fbf9;border:1px solid #c8e0d8;border-radius:6px;}",
    "table{width:100%;border-collapse:collapse;font-size:13px;}",
    "thead tr{background:#e1f5ee;}",
    "th{color:#0F6E56;font-weight:600;padding:9px 10px;text-align:right;border-bottom:2px solid #9FE1CB;font-size:12px;}",
    "td{padding:7px 10px;border-bottom:1px solid #eef5f2;}",
    "tbody tr:nth-child(even) td{background:#f7fbf9;}",
    ".doc-footer{padding:.9rem 2rem;background:#f7fbf9;display:flex;justify-content:space-between;align-items:flex-end;border-top:2px solid #9FE1CB;}",
    ".sig-area{text-align:center;}",
    ".sig-line{width:150px;border-top:1px solid #7a9a8a;margin-top:8px;margin-bottom:4px;}",
    ".sig-label{font-size:11px;color:#7a9a8a;}",
    "@media print{@page{size:A4 portrait;margin:12mm}body{background:white;padding:0}.doc{box-shadow:none;border-radius:0;}}",
    "</style>",
    "</head>",
    "<body>",
    "<div class='doc'>",

    // Header
    "<div class='doc-header'>",
    "<div>",
    "<div style='font-size:17px;font-weight:600;color:#0F6E56;margin-bottom:5px;'>דגי גלבוע — אגש\"ח בע\"מ</div>",
    "<div style='font-size:12px;color:#5a7a6e;line-height:1.9;'>קיבוץ בית אלפא 1080200<br>טל׳: 04-6533052 | פקס׳: 04-6533571<br>fishba@betalfa.org.il | ח.פ. 870061523</div>",
    "</div>",
    "<div style='text-align:left;min-width:200px;'>",
    "<div class='doc-title'>תעודת משלוח</div>",
    "<div class='meta-row'><label style='font-size:12px;color:#7a9a8a;'>מס׳ תעודה:</label><span class='badge'>" + d.certNum + "</span></div>",
    "<div class='meta-row'><label style='font-size:12px;color:#7a9a8a;'>תאריך:</label><span style='font-size:13px;font-weight:500;'>" + d.dateFormatted + "</span></div>",
    "<div class='meta-row'><label style='font-size:12px;color:#7a9a8a;'>שעת מסירה:</label><span style='font-size:13px;font-weight:500;'>" + (d.loadingTime || "—") + "</span></div>",
    "</div>",
    "</div>",

    // Client section
    "<div class='section'>",
    "<div class='sec-title'>פרטי לקוח</div>",
    "<div class='grid-3'>",
    "<div><div class='field-lbl'>שם לקוח / חברה</div><div class='field-val'>" + d.clientDisplayName + "</div></div>",
    "<div><div class='field-lbl'>ח.פ. / פרטי קשר</div><div class='field-val'>" + d.clientContact + "</div></div>",
    orderRefSection,
    "</div>",
    "</div>",

    // Details table
    "<div class='section'>",
    "<div class='sec-title'>פרטי משלוח</div>",
    "<table>",
    "<thead><tr>",
    "<th style='width:32px'>#</th><th>מס׳ טנק</th><th>סוג דג</th><th>בריכת מקור</th><th style='width:110px;text-align:center'>משקל (ק\"ג)</th>",
    "</tr></thead>",
    "<tbody>" + rowsHtml + "</tbody>",
    "<tfoot><tr style='background:#e1f5ee;font-weight:700;'>",
    "<td colspan='4' style='padding:9px 10px;color:#0F6E56;font-size:12px;'>סה\"כ משקל</td>",
    "<td style='padding:9px 10px;text-align:center;color:#0F6E56;font-size:16px;'>" + totalWeight.toFixed(1) + " ק\"ג</td>",
    "</tr></tfoot>",
    "</table>",
    "</div>",

    // Transport section
    "<div class='section' style='border-bottom:none;'>",
    "<div class='sec-title'>פרטי הובלה ואחריות</div>",
    "<div class='grid-4'>",
    "<div><div class='field-lbl'>שם המשלח</div><div class='field-val'>" + d.producerName + "</div></div>",
    "<div><div class='field-lbl'>שם הנהג</div><div class='field-val'>" + d.driverDisplay + "</div></div>",
    "<div><div class='field-lbl'>מספר רישוי</div><div class='field-val'>" + d.plateDisplay + "</div></div>",
    "<div><div class='field-lbl'>אישור וטרינרי</div><div class='field-val'>" + (d.vetApprovalRef || "—") + "</div></div>",
    "</div>",
    notesSection,
    "</div>",

    // Footer / signatures
    "<div class='doc-footer'>",
    "<div class='sig-area'>",
    sigHtml,
    "<div class='sig-line'></div>",
    "<div class='sig-label'>חתימת אחראי: " + d.managerName + "</div>",
    "</div>",
    "<div style='font-size:11px;color:#9abaa8;text-align:center;'>מסמך זה הופק ממערכת מידגה<br>" + today + "</div>",
    "<div class='sig-area'>",
    "<div style='height:48px;'></div>",
    "<div class='sig-line'></div>",
    "<div class='sig-label'>חתימת הלקוח</div>",
    "</div>",
    "</div>",

    "</div>", // .doc
    "<script>setTimeout(function(){window.print();},500);<" + "/script>",
    "</body>",
    "</html>",
  ].join("\n");
}
