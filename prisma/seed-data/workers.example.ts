// TEMPLATE - copy this file to workers.local.ts and fill in real data.
// workers.local.ts is gitignored (see prisma/seed-data/README.md) because it
// holds real people's names, phone numbers, and email addresses. This
// example file uses fake data so the shape is documented in source control
// without exposing anyone's real PII.

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

export const REAL_WORKERS: WorkerSeed[] = [
  { firstName: "ישראל", lastName: "ישראלי", roleTitle: "מנהל תפעול", language: "עברית", latinFirstName: null, latinLastName: null, nickname: null, phone: "050-0000000", phone2: null, email: "example@example.com", email2: null },
];

export const REAL_WORKER_ROLE_GRANTS: WorkerRoleGrantSeed[] = [
  { workerFirstName: "ישראל", grants: [{ role: "מנהל תפעול", module: "תפעול", accessLevel: 4 }] },
];
