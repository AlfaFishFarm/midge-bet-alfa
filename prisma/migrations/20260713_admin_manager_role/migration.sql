-- Give the admin (מנהל מערכת) worker a "מנהל מדגה" role on the תפעול module
-- so they appear in the delivery-cert manager/approver dropdown.
-- Safe to run multiple times (INSERT ... WHERE NOT EXISTS).

INSERT INTO "WorkerRole" (id, "workerId", "roleId", "moduleId", "accessLevel")
SELECT
  gen_random_uuid()::text,
  w.id,
  r.id,
  m.id,
  1
FROM "Worker" w
JOIN "User" u ON u.id = w."userAccountId"
JOIN "Role" r ON r.name = 'מנהל מדגה'
JOIN "AppModule" m ON m.name = 'תפעול'
WHERE u.username = 'admin'
  AND NOT EXISTS (
    SELECT 1 FROM "WorkerRole" wr
    WHERE wr."workerId" = w.id AND wr."roleId" = r.id AND wr."moduleId" = m.id
  );
