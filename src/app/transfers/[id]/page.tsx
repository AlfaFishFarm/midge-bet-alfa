import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/current-user";
import { bestAccessForModule, meetsRequirement, AccessLevel } from "@/lib/permissions";
import { prisma } from "@/lib/db";
import TransferDetailManager from "./TransferDetailManager";

interface Props {
  params: { id: string };
}

function computeCycleCode(pondCode: string | null, openedAt: Date): string {
  const d = new Date(openedAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return pondCode ? `${pondCode}-${yyyy}${mm}${dd}` : `${yyyy}${mm}${dd}`;
}

export default async function TransferDetailPage({ params }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const level = bestAccessForModule(user.permissions, "תפעול");
  if (!meetsRequirement(level, AccessLevel.VIEW_ONLY)) {
    return (
      <main className="p-6">
        <p className="text-red-600">אין לך הרשאה לצפות בעמוד זה.</p>
      </main>
    );
  }

  const canEdit = meetsRequirement(level, AccessLevel.OPERATIONS);

  const header = await prisma.fishTransferHeader.findUnique({
    where: { id: params.id },
    include: {
      sourcePond: { select: { id: true, code: true, name: true } },
      cycle: { select: { id: true, priorityCycleCode: true, openedAt: true } },
      supplier: { select: { id: true, name: true } },
      details: {
        include: {
          fishStrain: { select: { id: true, englishName: true, latinName: true } },
          destPond: { select: { id: true, code: true, name: true } },
          populationCode: { select: { id: true, code: true } },
          transferMeans: {
            select: { id: true, meansType: true, internalTankId: true, externalVehicleCode: true },
          },
          weighings: { select: { id: true, date: true } },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!header) notFound();

  const cycleCode = computeCycleCode(header.sourcePond.code, header.cycle.openedAt);

  const serializedDetails = header.details.map((d) => ({
    ...d,
    transferTime: d.transferTime?.toISOString() ?? null,
    weighings: d.weighings.map((w) => ({ ...w, date: w.date.toISOString() })),
  }));

  const fishStrains = await prisma.fishStrain.findMany({ orderBy: { latinName: "asc" } });

  // Badge colour per transfer type — matches prototype tf-badge-* classes
  const badgeColor: Record<string, string> = {
    "קניה":  "#3D9A6A",
    "דילול": "#3A8FD4",
    "פירוק": "#2BAEA6",
    "שיווק": "#F0983A",
    "תמותה": "#E8554A",
  };
  const badgeBg = badgeColor[header.transferType] ?? "#2BAEA6";
  const srcLabel = header.transferType === "קניה" && header.supplier
    ? `ספק: ${header.supplier.name}`
    : header.sourcePond.name;

  return (
    <div
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 54px)", background: "#F2EDE3" }}
    >
      {/* Fixed top nav bar — exact prototype .tf-back-btn / .tf-breadcrumb / .tf-type-badge */}
      <div style={{ background: "#1B3A2B", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Link href="/transfers" className="tf-back-btn" style={{ textDecoration: "none" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            חזרה
          </Link>
          <span className="tf-breadcrumb">תפעול › העברות</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="tf-type-badge" style={{ background: badgeBg }}>
            {header.transferType}
          </span>
        </div>
      </div>

      {/* Scrollable content — prototype .transfer-scrollable */}
      <div className="transfer-scrollable">
        {/* Part A — prototype .tf-header-section / .tf-section-title / .tf-header-row / .tf-field / .tf-label / .tf-date-input */}
        <div className="tf-header-section">
          <div className="tf-section-title">פרטי העברה</div>
          <div className="tf-header-row">
            <div className="tf-field tf-field-date">
              <span className="tf-label">תאריך</span>
              <div className="tf-date-input" style={{ background: "#f8fafc", color: "#1a2744" }}>
                {new Date(header.transferDate).toLocaleDateString("he-IL")}
              </div>
            </div>
            <div className="tf-field tf-field-pool">
              <span className="tf-label">בריכת שליה</span>
              <div className="tf-date-input" style={{ background: "#f8fafc", color: "#1a2744" }}>
                {srcLabel}
              </div>
            </div>
            <div className="tf-field" style={{ flex: "0 0 120px" }}>
              <span className="tf-label opt">קוד בריכה</span>
              <div className="tf-date-input" style={{ background: "#f1f5f9", color: "#374151", fontWeight: 700 }}>
                {header.sourcePond.code ?? "—"}
              </div>
            </div>
            <div className="tf-field" style={{ flex: "0 0 170px" }}>
              <span className="tf-label opt">מחזור</span>
              <div className="tf-date-input" style={{ background: "#f1f5f9", color: "#374151", fontFamily: "monospace" }}>
                {cycleCode}
              </div>
            </div>
          </div>
        </div>

        <RegularSection
          header={{
            id: header.id,
            transferType: header.transferType,
            transferDate: header.transferDate.toISOString(),
            status: header.status,
            sourcePondId: header.sourcePondId,
            sourcePondName: header.sourcePond.name,
            cycleId: header.cycleId,
            cycleCode,
            supplierName: header.supplier?.name ?? null,
            notes: header.notes,
          }}
          initialDetails={serializedDetails}
          fishStrains={fishStrains}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

// Async server component — loads transfer-specific reference data.
// תמותה is merged back into this single manager (2026-06-21, per the
// fish-farm-manager-v11 prototype) — it just needs the virtual receiving pond's id.
async function RegularSection({
  header, initialDetails, fishStrains, canEdit,
}: {
  header: {
    id: string;
    transferType: string;
    transferDate: string;
    status: string;
    sourcePondId: string;
    sourcePondName: string;
    cycleId: string;
    cycleCode: string;
    supplierName?: string | null;
    notes?: string | null;
  };
  initialDetails: Parameters<typeof TransferDetailManager>[0]["initialDetails"];
  fishStrains: { id: string; englishName: string | null; latinName: string }[];
  canEdit: boolean;
}) {
  const [pondsRaw, populationCodes, weightTypes, tanks, suppliers, virtualPond, rosterDetails] =
    await Promise.all([
      // Full pond list with pondType + active-cycle status, so the client applies its own
      // type-specific filtering (e.g. דילול/פירוק show concrete ponds only; שיווק shows
      // the מחסן שיווק warehouse) and can show open/closed status in the combobox
      // (Dean, 2026-06-29: pond search must always show code+name+open/closed status,
      // and only the computed cycle code — never priorityCycleCode — across transfers).
      prisma.pond.findMany({
        include: {
          pondType: { select: { name: true } },
          growthCycles: { where: { closedAt: null }, select: { id: true, openedAt: true }, take: 1 },
        },
        orderBy: [{ code: "asc" }, { name: "asc" }],
      }),
      prisma.populationCode.findMany({ orderBy: { code: "asc" } }),
      prisma.weightType.findMany({ orderBy: { name: "asc" } }),
      prisma.tank.findMany({ select: { id: true, code: true }, orderBy: { code: "asc" } }),
      prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.pond.findFirst({ where: { pondType: { name: { contains: "וירטואלית" } } } }),
      // Roster strains: distinct fish strains already in the source pond this cycle
      // via any completed or draft קניה transfers. Used to determine whether the
      // החלפת דגים dialog should fire when a new strain is selected (spec p.42).
      prisma.fishTransferDetail.findMany({
        where: {
          header: {
            cycleId: header.cycleId,
            sourcePondId: header.sourcePondId,
            transferType: "קניה",
          },
        },
        select: { fishStrainId: true },
        distinct: ["fishStrainId"],
      }),
    ]);

  const pondRosterStrainIds = rosterDetails.map((d) => d.fishStrainId);

  const allPonds = pondsRaw.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    pondTypeName: p.pondType.name,
    hasActiveCycle: p.growthCycles.length > 0,
    activeCycleCode: p.growthCycles[0] ? computeCycleCode(p.code, p.growthCycles[0].openedAt) : null,
  }));

  return (
    <TransferDetailManager
      header={header}
      initialDetails={initialDetails}
      fishStrains={fishStrains}
      allPonds={allPonds}
      populationCodes={populationCodes}
      weightTypes={weightTypes}
      tanks={tanks}
      suppliers={suppliers}
      canEdit={canEdit}
      virtualPondId={virtualPond?.id ?? ""}
      pondRosterStrainIds={pondRosterStrainIds}
    />
  );
}
