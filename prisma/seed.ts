import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Access levels mirror src/lib/permissions.ts (kept duplicated here on purpose -
// this script runs standalone via tsx, before the app's TS path aliases exist).
const FULL_EDIT = 1;
const DOMAIN_MANAGE = 2;
const EXECUTIVE = 3;
const OPERATIONS = 4;
const VIEW_ONLY = 5;
const NO_ACCESS = 6;

// ---------------------------------------------------------------------------
// Real reference data, extracted 2026-06-19 from files the user added to the
// workspace folder ("טבלאות מטה דאטה/" - ponds-sivan.xlsx, fish-sivan.xlsx,
// growingStages-sivan.xlsx, workers-sivan.xlsx). See memory file
// fish_farm_app_source_files.md for provenance. Replaces the earlier
// 2-pond / 1-fish placeholder seed with the farm's actual register.
// ---------------------------------------------------------------------------

// 49 real ponds (ponds-sivan.xlsx). pondType classification (בריכה רגילה / בריכה
// גדולה) is a heuristic based on the id prefix (R### = large reservoir) and area -
// not in the source file - flag for confirmation if it matters for reporting.
const REAL_PONDS = [
  { code: "P100", name: "מחסן באר", pondType: "בריכה רגילה", areaDunam: 2.0, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 2, latitude: 32.5220729017, longitude: 35.4464975469022 },
  { code: "P102", name: "מחסן 2", pondType: "בריכה רגילה", areaDunam: 3.5, feeders: 0, spreaders: null, electricity: 1, oxygenUnits: 3, latitude: 32.5283664967854, longitude: 35.4410792723379 },
  { code: "P103", name: "מחסן 3", pondType: "בריכה רגילה", areaDunam: 3.0, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 3, latitude: 32.5279274972717, longitude: 35.4416422723379 },
  { code: "P105", name: "מחסן 5", pondType: "בריכה רגילה", areaDunam: 10.0, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 8, latitude: 32.527265589755, longitude: 35.4441900011741 },
  { code: "P106", name: "מחסן 6", pondType: "בריכה רגילה", areaDunam: 11.0, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 6, latitude: 32.5277680203603, longitude: 35.4433690011741 },
  { code: "P107", name: "מחסן 7", pondType: "בריכה רגילה", areaDunam: 10.0, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 6, latitude: 32.5282884968718, longitude: 35.443824636756 },
  { code: "P108", name: "מחסן 8", pondType: "בריכה רגילה", areaDunam: 6.0, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 6, latitude: 32.5285930715701, longitude: 35.4422207334105 },
  { code: "P109", name: "מחסן 9", pondType: "בריכה רגילה", areaDunam: 7.0, feeders: 1, spreaders: 2, electricity: 1, oxygenUnits: 8, latitude: 32.5290634960134, longitude: 35.4418343655922 },
  { code: "P110", name: "מחסן 10", pondType: "בריכה רגילה", areaDunam: 7.0, feeders: 1, spreaders: 2, electricity: 1, oxygenUnits: 7, latitude: 32.5296334953819, longitude: 35.4420437300103 },
  { code: "P111", name: "מחסן 11", pondType: "בריכה רגילה", areaDunam: 3.5, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 3, latitude: 32.5293390642072, longitude: 35.4407080011741 },
  { code: "P112", name: "מחסן 12", pondType: "בריכה רגילה", areaDunam: 3.5, feeders: 1, spreaders: 1, electricity: 1, oxygenUnits: 3, latitude: 32.5298320179701, longitude: 35.4409283655922 },
  { code: "P113", name: "יא", pondType: "בריכה רגילה", areaDunam: 4.5, feeders: 0, spreaders: 0, electricity: 2, oxygenUnits: 3, latitude: 32.529660109438, longitude: 35.4397423655922 },
  { code: "P114", name: "שליה 1", pondType: "בריכה רגילה", areaDunam: 13.0, feeders: 1, spreaders: 2, electricity: 4, oxygenUnits: 12, latitude: 32.523086316424, longitude: 35.4552620045745 },
  { code: "P115", name: "שליה יג", pondType: "בריכה רגילה", areaDunam: 7.0, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 4, latitude: 32.5299390683169, longitude: 35.4377848180657 },
  { code: "P116", name: "ט", pondType: "בריכה רגילה", areaDunam: 12.0, feeders: 1, spreaders: 2, electricity: 1, oxygenUnits: 8, latitude: 32.5304361126826, longitude: 35.4432784622466 },
  { code: "P117", name: "17", pondType: "בריכה רגילה", areaDunam: 20.0, feeders: 1, spreaders: 4, electricity: 4, oxygenUnits: 14, latitude: 32.5275350741274, longitude: 35.4401820045744 },
  { code: "P118", name: "18", pondType: "בריכה רגילה", areaDunam: 14.0, feeders: 1, spreaders: 2, electricity: 1, oxygenUnits: 8, latitude: 32.5265400305736, longitude: 35.4406008180658 },
  { code: "P119", name: "יוד", pondType: "בריכה רגילה", areaDunam: 24.0, feeders: 1, spreaders: 3, electricity: 1, oxygenUnits: 7, latitude: 32.5312321106784, longitude: 35.4404244622465 },
  { code: "R101", name: "אגם 1", pondType: "בריכה גדולה", areaDunam: 160.0, feeders: 3, spreaders: 12, electricity: 15, oxygenUnits: 57, latitude: 32.5257731244224, longitude: 35.4524725469021 },
  { code: "R102", name: "אגם 2", pondType: "בריכה גדולה", areaDunam: 110.0, feeders: 3, spreaders: 11, electricity: 11, oxygenUnits: 36, latitude: 32.5234390377558, longitude: 35.4489960892298 },
  { code: "R103", name: "אגם 3", pondType: "בריכה גדולה", areaDunam: 90.0, feeders: 3, spreaders: 12, electricity: 10, oxygenUnits: 34, latitude: 32.5255289868557, longitude: 35.4458370045744 },
  { code: "P124", name: "ח", pondType: "בריכה רגילה", areaDunam: 39.0, feeders: 2, spreaders: 8, electricity: 8, oxygenUnits: 13, latitude: 32.5284459803931, longitude: 35.4386538180657 },
  { code: "P125", name: "יג", pondType: "בריכה רגילה", areaDunam: 60.0, feeders: 3, spreaders: 8, electricity: 5, oxygenUnits: 15, latitude: 32.5287448882623, longitude: 35.4360038180658 },
  { code: "P126", name: "26", pondType: "בריכה רגילה", areaDunam: 35.0, feeders: 2, spreaders: 8, electricity: 4, oxygenUnits: 21, latitude: 32.5262295451314, longitude: 35.4426023655922 },
  { code: "P127", name: "27", pondType: "בריכה רגילה", areaDunam: 22.0, feeders: 2, spreaders: 4, electricity: 4, oxygenUnits: 10, latitude: 32.527708982026, longitude: 35.448883546902 },
  { code: "P131", name: "א אינטנסיבית", pondType: "בריכה רגילה", areaDunam: 0.45, feeders: null, spreaders: 0, electricity: null, oxygenUnits: 2, latitude: 32.5293753586868, longitude: 35.4392863655922 },
  { code: "P132", name: "ב אינטנסיבית", pondType: "בריכה רגילה", areaDunam: 0.5, feeders: null, spreaders: 0, electricity: null, oxygenUnits: 3, latitude: 32.5294389727699, longitude: 35.438991636756 },
  { code: "P133", name: "ג אינטנסיבית", pondType: "בריכה רגילה", areaDunam: 0.8, feeders: null, spreaders: 0, electricity: null, oxygenUnits: 3, latitude: 32.5295425411281, longitude: 35.4386430011741 },
  { code: "P134", name: "ד אינטנסיבית", pondType: "בריכה רגילה", areaDunam: 0.8, feeders: null, spreaders: 0, electricity: null, oxygenUnits: 3, latitude: 32.5298369723491, longitude: 35.4388470011741 },
  { code: "P135", name: "ה אינטנסיבית", pondType: "בריכה רגילה", areaDunam: 0.45, feeders: null, spreaders: 0, electricity: null, oxygenUnits: 2, latitude: 32.5298364951571, longitude: 35.4392490944283 },
  { code: "P141", name: "A", pondType: "בריכה רגילה", areaDunam: 0.8, feeders: 0, spreaders: null, electricity: null, oxygenUnits: 1, latitude: 32.5286559735978, longitude: 35.4402319079199 },
  { code: "P142", name: "B", pondType: "בריכה רגילה", areaDunam: 0.8, feeders: 0, spreaders: null, electricity: null, oxygenUnits: 1, latitude: 32.5285065881305, longitude: 35.4405105435017 },
  { code: "P143", name: "C", pondType: "בריכה רגילה", areaDunam: 0.8, feeders: 0, spreaders: null, electricity: null, oxygenUnits: 2, latitude: 32.528791973454, longitude: 35.4407040011741 },
  { code: "P151", name: "A1", pondType: "בריכה רגילה", areaDunam: 0.6, feeders: null, spreaders: null, electricity: null, oxygenUnits: 1, latitude: 32.5282940197511, longitude: 35.440003272338 },
  { code: "P152", name: "A2", pondType: "בריכה רגילה", areaDunam: 0.7, feeders: null, spreaders: null, electricity: 1, oxygenUnits: 1, latitude: 32.5282076343034, longitude: 35.4402717300103 },
  { code: "P153", name: "A3.5", pondType: "בריכה רגילה", areaDunam: 0.6, feeders: null, spreaders: null, electricity: 1, oxygenUnits: 1, latitude: 32.5280139742766, longitude: 35.4405379079198 },
  { code: "P155", name: "A5", pondType: "בריכה רגילה", areaDunam: 0.6, feeders: null, spreaders: null, electricity: 1, oxygenUnits: 1, latitude: 32.5278649744342, longitude: 35.4408813655922 },
  { code: "P156", name: "A6", pondType: "בריכה רגילה", areaDunam: 2.0, feeders: null, spreaders: null, electricity: 1, oxygenUnits: 2, latitude: 32.5276210205305, longitude: 35.4413155435018 },
  { code: "P206", name: "6 עח", pondType: "בריכה רגילה", areaDunam: 9.8, feeders: 1, spreaders: 1, electricity: 1, oxygenUnits: 7, latitude: 32.5346050570381, longitude: 35.4041995469017 },
  { code: "P209", name: "9 עח", pondType: "בריכה רגילה", areaDunam: 5.8, feeders: 1, spreaders: 2, electricity: 2, oxygenUnits: 6, latitude: 32.5346050570381, longitude: 35.4041995469017 },
  { code: "R212", name: "12 עח", pondType: "בריכה גדולה", areaDunam: 72.0, feeders: 3, spreaders: 12, electricity: 6, oxygenUnits: 28, latitude: 32.5295938865521, longitude: 35.4147565469019 },
  { code: "R214", name: "14 עח", pondType: "בריכה גדולה", areaDunam: 36.0, feeders: 2, spreaders: 8, electricity: 4, oxygenUnits: 26, latitude: 32.5346050570381, longitude: 35.4041995469017 },
  { code: "P231", name: "א עח", pondType: "בריכה רגילה", areaDunam: 3.2, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 4, latitude: 32.5373180056063, longitude: 35.4019042757378 },
  { code: "P232", name: "ב עח", pondType: "בריכה רגילה", areaDunam: 3.7, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 4, latitude: 32.536802051727, longitude: 35.4018502757377 },
  { code: "P233", name: "ג עח", pondType: "בריכה רגילה", areaDunam: 3.3, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 4, latitude: 32.5362959629989, longitude: 35.401807004574 },
  { code: "P234", name: "ד עח", pondType: "בריכה רגילה", areaDunam: 2.8, feeders: 1, spreaders: 1, electricity: 2, oxygenUnits: 4, latitude: 32.5357260543282, longitude: 35.4015607334101 },
  { code: "P157", name: "דאלאס", pondType: "בריכה רגילה", areaDunam: null, feeders: null, spreaders: null, electricity: null, oxygenUnits: null, latitude: 32.526605076375, longitude: 35.4477357334106 },
  { code: "ST01", name: "בור משלוחים", pondType: "בור", areaDunam: null, feeders: null, spreaders: null, electricity: null, oxygenUnits: null, latitude: null, longitude: null },
  { code: "Main", name: "מחסן ראשי", pondType: "מחסן שיווק", areaDunam: null, feeders: null, spreaders: null, electricity: null, oxygenUnits: null, latitude: null, longitude: null },
];

// 8 real fish strains (fish-sivan.xlsx, "fishStrain" columns). "European Bass" shares
// the same Latin name as "Sea Bass" in the source file itself - kept as two rows
// (not merged) since that's how the source lists them; flagged for Dana to confirm.
const REAL_FISH_STRAINS = [
  { key: "sea_bass", englishName: "Sea Bass", latinName: "Dicentrarchus labrax", notes: null },
  { key: "tilapia", englishName: "Tilapia", latinName: "Oreochromis niloticus", notes: null },
  { key: "common_carp", englishName: "Common Carp", latinName: "Cyprinus carpio", notes: null },
  { key: "mullet", englishName: "Mullet", latinName: "Mugil cephalus", notes: null },
  { key: "european_bass", englishName: "European Bass", latinName: "Dicentrarchus labrax", notes: "שם לטיני זהה ל-Sea Bass במקור (fish-sivan.xlsx) - כפילות אפשרית, לאשר עם דנה" },
  { key: "meager", englishName: "Meager", latinName: "Argyrosomus regius", notes: null },
  { key: "black_carp", englishName: "Black Carp", latinName: "Mylopharyngodon piceus", notes: null },
  { key: "silver_carp", englishName: "Silver Carp", latinName: "Hypophthalmichthys molitrix", notes: null },
];

// 13 real products (fish-sivan.xlsx, "Products" columns) with their real Priority IDs.
// strainKey links back to REAL_FISH_STRAINS where a confident match exists - null
// where the source gave no matching strain row (פומפנו/אמור/פנגסיוס).
const REAL_PRODUCTS = [
  { priorityProductId: "14", name: "בס", strainKey: "sea_bass" },
  { priorityProductId: "12", name: "אמנון", strainKey: "tilapia" },
  { priorityProductId: "25", name: "קרפיון", strainKey: "common_carp" },
  { priorityProductId: "13", name: "בורי", strainKey: "mullet" },
  { priorityProductId: "21", name: "לברק", strainKey: "european_bass" },
  { priorityProductId: "22", name: "מוסר", strainKey: "meager" },
  { priorityProductId: null, name: "קרפיון שחור", strainKey: "black_carp" },
  { priorityProductId: "20", name: "כסיף", strainKey: "silver_carp" },
  { priorityProductId: "30", name: "פומפנו", strainKey: null },
  { priorityProductId: "81", name: "אמנון נקבה", strainKey: "tilapia" },
  { priorityProductId: "120001", name: "דגיג אמנון מיוצר", strainKey: "tilapia" },
  { priorityProductId: "11", name: "אמור", strainKey: null },
  { priorityProductId: "31", name: "פנגסיוס", strainKey: null },
];

// Real per-product growing stage lists (growingStages-sivan.xlsx). Only בס and אמנון
// had stage rows in the source - other products have no stage data yet.
const REAL_PRODUCT_STAGES: Record<string, string[]> = {
  "בס": ["אימון 1", "אימון 2", "פיטום", "שיווק"],
  "אמנון": ["אימון 1", "אימון 2", "שמירת חורף", "פיטום", "שיווק"],
};

// 19 real workers + their approximate RBAC grants live in
// prisma/seed-data/workers.local.ts, which is GITIGNORED on purpose - it
// contains real names, phone numbers, and email addresses, and must never be
// committed to source control. See prisma/seed-data/README.md. If that file
// is missing (e.g. a fresh clone without access to the real data), worker
// seeding is skipped with a warning rather than failing the whole script.
type WorkerSeed = {
  firstName: string;
  lastName: string | null;
  roleTitle: string | null;
  language: string;
  latinFirstName: string | null;
  latinLastName: string | null;
  nickname: string | null;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  email2: string | null;
};
type WorkerRoleGrantSeed = {
  workerFirstName: string;
  grants: Array<{ role: string; module: string; accessLevel: number }>;
};

async function loadRealWorkerData(): Promise<{
  workers: WorkerSeed[];
  grants: WorkerRoleGrantSeed[];
}> {
  try {
    const mod = await import("./seed-data/workers.local");
    return { workers: mod.REAL_WORKERS, grants: mod.REAL_WORKER_ROLE_GRANTS };
  } catch {
    console.warn(
      "prisma/seed-data/workers.local.ts not found - skipping real worker seed data " +
        "(this file holds real PII and is gitignored on purpose). " +
        "See prisma/seed-data/README.md to restore it."
    );
    return { workers: [], grants: [] };
  }
}

async function main() {
  console.log("Seeding reference data...");

  // ---------- Modules ----------
  const modules = await Promise.all(
    ["תפעול", "הזנה", "בריאות", "אדמיניסטרציה", "סיכום נתונים", "דשבורד"].map((name) =>
      prisma.appModule.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const moduleByName = new Map(modules.map((m) => [m.name, m]));
  const [opsModule, , , adminModule, reportsModule, dashboardModule] = modules;

  // ---------- Roles ----------
  const roleNames = [
    "מתכנת",
    "מנהל מדגה",
    "מנהל תפעול",
    "מנהל הזנה",
    "מנהל בריאות",
    "עובד שטח",
    "יועץ",
    "צפייה בלבד",
  ];
  const roles = await Promise.all(
    roleNames.map((name) =>
      prisma.role.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const roleByName = new Map(roles.map((r) => [r.name, r]));
  const [programmerRole] = roles;

  // ---------- Admin user (placeholder credentials - change immediately) ----------
  // Override via ADMIN_SEED_PASSWORD in .env so the well-known default below
  // doesn't end up being the real password anywhere this script runs (e.g. a
  // shared/staging environment). update: {} below means re-running seed never
  // overwrites a password you've already changed by hand.
  const adminUsername = "admin";
  const adminPasswordPlain = process.env.ADMIN_SEED_PASSWORD ?? "ChangeMe123!";
  const passwordHash = await bcrypt.hash(adminPasswordPlain, 12);

  const adminUser = await prisma.user.upsert({
    where: { username: adminUsername },
    update: { passwordHash, active: true },
    create: { username: adminUsername, passwordHash, active: true },
  });

  const adminWorker = await prisma.worker.upsert({
    where: { userAccountId: adminUser.id },
    update: {},
    create: {
      firstName: "מנהל",
      lastName: "מערכת",
      userAccountId: adminUser.id,
      active: true,
    },
  });

  await prisma.workerRole.upsert({
    where: {
      workerId_roleId_moduleId: {
        workerId: adminWorker.id,
        roleId: programmerRole.id,
        moduleId: adminModule.id,
      },
    },
    update: { accessLevel: FULL_EDIT },
    create: {
      workerId: adminWorker.id,
      roleId: programmerRole.id,
      moduleId: adminModule.id,
      accessLevel: FULL_EDIT,
    },
  });

  await prisma.workerRole.upsert({
    where: {
      workerId_roleId_moduleId: {
        workerId: adminWorker.id,
        roleId: programmerRole.id,
        moduleId: opsModule.id,
      },
    },
    update: { accessLevel: FULL_EDIT },
    create: {
      workerId: adminWorker.id,
      roleId: programmerRole.id,
      moduleId: opsModule.id,
      accessLevel: FULL_EDIT,
    },
  });

  await prisma.workerRole.upsert({
    where: {
      workerId_roleId_moduleId: {
        workerId: adminWorker.id,
        roleId: programmerRole.id,
        moduleId: reportsModule.id,
      },
    },
    update: { accessLevel: FULL_EDIT },
    create: {
      workerId: adminWorker.id,
      roleId: programmerRole.id,
      moduleId: reportsModule.id,
      accessLevel: FULL_EDIT,
    },
  });

  await prisma.workerRole.upsert({
    where: {
      workerId_roleId_moduleId: {
        workerId: adminWorker.id,
        roleId: programmerRole.id,
        moduleId: dashboardModule.id,
      },
    },
    update: { accessLevel: FULL_EDIT },
    create: {
      workerId: adminWorker.id,
      roleId: programmerRole.id,
      moduleId: dashboardModule.id,
      accessLevel: FULL_EDIT,
    },
  });

  // ---------- Real workers + approximate RBAC grants ----------
  const { workers: REAL_WORKERS, grants: REAL_WORKER_ROLE_GRANTS } = await loadRealWorkerData();

  const workersByFirstName = new Map<string, { id: string }>();
  for (const w of REAL_WORKERS) {
    const worker = await prisma.worker.upsert({
      where: { id: `seed-worker-${w.firstName}` },
      update: {
        lastName: w.lastName,
        roleTitle: w.roleTitle,
        language: w.language,
        latinFirstName: w.latinFirstName,
        latinLastName: w.latinLastName,
        nickname: w.nickname,
        phone: w.phone,
        phone2: w.phone2,
        email: w.email,
        email2: w.email2,
      },
      create: {
        id: `seed-worker-${w.firstName}`,
        firstName: w.firstName,
        lastName: w.lastName,
        roleTitle: w.roleTitle,
        language: w.language,
        latinFirstName: w.latinFirstName,
        latinLastName: w.latinLastName,
        nickname: w.nickname,
        phone: w.phone,
        phone2: w.phone2,
        email: w.email,
        email2: w.email2,
        active: true,
      },
    });
    workersByFirstName.set(w.firstName, worker);
  }

  for (const entry of REAL_WORKER_ROLE_GRANTS) {
    const worker = workersByFirstName.get(entry.workerFirstName);
    if (!worker) continue;
    for (const grant of entry.grants) {
      const role = roleByName.get(grant.role);
      const targetModule = moduleByName.get(grant.module);
      if (!role || !targetModule) continue;
      await prisma.workerRole.upsert({
        where: {
          workerId_roleId_moduleId: {
            workerId: worker.id,
            roleId: role.id,
            moduleId: targetModule.id,
          },
        },
        update: { accessLevel: grant.accessLevel },
        create: {
          workerId: worker.id,
          roleId: role.id,
          moduleId: targetModule.id,
          accessLevel: grant.accessLevel,
        },
      });
    }
  }

  // ---------- Pond types ----------
  const pondTypeNames = [
    "בריכה רגילה",
    "בריכה גדולה",
    "בור",
    "מחסן שיווק",
    "בריכה וירטואלית לקליטה",
    "בריכה וירטואלית למשלוח",
  ];
  const pondTypes = await Promise.all(
    pondTypeNames.map((name) =>
      prisma.pondType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const pondTypeByName = new Map(pondTypes.map((pt) => [pt.name, pt]));

  // ---------- Real ponds ----------
  for (const p of REAL_PONDS) {
    const pondType = pondTypeByName.get(p.pondType);
    if (!pondType) continue;
    await prisma.pond.upsert({
      where: { code: p.code },
      update: {
        name: p.name,
        pondTypeId: pondType.id,
        areaDunam: p.areaDunam,
        feeders: p.feeders,
        spreaders: p.spreaders,
        electricity: p.electricity,
        oxygenUnits: p.oxygenUnits,
        latitude: p.latitude,
        longitude: p.longitude,
      },
      create: {
        name: p.name,
        code: p.code,
        pondTypeId: pondType.id,
        areaDunam: p.areaDunam,
        feeders: p.feeders,
        spreaders: p.spreaders,
        electricity: p.electricity,
        oxygenUnits: p.oxygenUnits,
        latitude: p.latitude,
        longitude: p.longitude,
      },
    });
  }

  await prisma.tank.upsert({
    where: { code: "T-01" },
    update: {},
    create: { code: "T-01", volume: 5 },
  });

  // ---------- Real fish strains ----------
  const strainByKey = new Map<string, { id: string }>();
  for (const s of REAL_FISH_STRAINS) {
    const strain = await prisma.fishStrain.upsert({
      where: { id: `seed-strain-${s.key}` },
      update: { latinName: s.latinName, englishName: s.englishName, notes: s.notes },
      create: {
        id: `seed-strain-${s.key}`,
        latinName: s.latinName,
        englishName: s.englishName,
        notes: s.notes,
      },
    });
    strainByKey.set(s.key, strain);
  }

  // ---------- Real products (with real Priority IDs) ----------
  const productByName = new Map<string, { id: string }>();
  for (const p of REAL_PRODUCTS) {
    const fishStrainId = p.strainKey ? strainByKey.get(p.strainKey)?.id ?? null : null;
    const product = await prisma.product.upsert({
      where: { id: `seed-product-${p.priorityProductId ?? p.name}` },
      update: { name: p.name, priorityProductId: p.priorityProductId, fishStrainId, active: true },
      create: {
        id: `seed-product-${p.priorityProductId ?? p.name}`,
        name: p.name,
        priorityProductId: p.priorityProductId,
        fishStrainId,
        active: true,
      },
    });
    productByName.set(p.name, product);
  }

  // ---------- Growing stages ----------
  // GrowingThreshold min/max values are TBD in the source spec - placeholder only.
  const growingStageNames = ["אימון 1", "אימון 2", "שמירת חורף", "פיטום", "שיווק"];
  const growingStages = await Promise.all(
    growingStageNames.map((name) =>
      prisma.growingStage.upsert({ where: { name }, update: {}, create: { name } })
    )
  );
  const stageByName = new Map(growingStages.map((g) => [g.name, g]));

  for (const [productName, stageNames] of Object.entries(REAL_PRODUCT_STAGES)) {
    const product = productByName.get(productName);
    if (!product) continue;
    for (const stageName of stageNames) {
      const stage = stageByName.get(stageName);
      if (!stage) continue;
      await prisma.growingThreshold.upsert({
        where: { productId_growingStageId: { productId: product.id, growingStageId: stage.id } },
        update: {},
        create: {
          productId: product.id,
          growingStageId: stage.id,
          notes: "ערכי סף ריקים במקור (growingStages-sivan.xlsx) - לעדכן לאחר אישור דנה",
        },
      });
    }
  }

  // ---------- Population codes ----------
  const populationCodeNames = ["אימון-1", "אימון-2", "פיטום", "הקפצת גודל", "שמירת חורף", "שיווק"];
  await Promise.all(
    populationCodeNames.map((code) =>
      prisma.populationCode.upsert({ where: { code }, update: {}, create: { code } })
    )
  );

  // ---------- Weight types ----------
  const weightTypeNames = ["שקילת ניטור-שטח", "שקילת ניטור-רשת", "שקילת אפיון טנק"];
  await Promise.all(
    weightTypeNames.map((name) =>
      prisma.weightType.upsert({ where: { name }, update: {}, create: { name } })
    )
  );

  // ---------- Suppliers (plausible Hebrew fish suppliers) ----------
  const supplierNames = [
    "דגי הגליל בע\"מ",
    "מדגת הצפון",
    "ספקי ים כינרת",
    "אמנון ובניו דגים",
    "קרפיון ישראל",
  ];
  await Promise.all(
    supplierNames.map((name) =>
      prisma.supplier.upsert({ where: { name }, update: {}, create: { name, active: true } })
    )
  );

  console.log("Seed complete.");
  console.log(`Seeded ${REAL_PONDS.length} real ponds, ${REAL_FISH_STRAINS.length} fish strains, ${REAL_PRODUCTS.length} products, ${REAL_WORKERS.length} workers.`);
  console.log(`Admin login -> username: ${adminUsername}  password: ${adminPasswordPlain}`);
  console.log("CHANGE THIS PASSWORD before using this outside your own machine.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
