"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "./SignaturePad";

interface LookupItem {
  id: string;
  name: string;
}

interface GrantRow {
  key: string; // local-only, for React list rendering / removal
  moduleId: string;
  roleId: string;
  accessLevel: number;
}

interface InitialData {
  firstName: string;
  lastName: string;
  latinFirstName: string;
  latinLastName: string;
  nickname: string;
  language: string;
  roleTitle: string;
  phone: string;
  phone2: string;
  email: string;
  email2: string;
  priorityEmployeeNo: string;
  active: boolean;
  username: string | null;
  grants: { moduleId: string; roleId: string; accessLevel: number }[];
  hasSignature?: boolean;
}

interface Props {
  mode: "create" | "edit";
  workerId?: string;
  roles: LookupItem[];
  modules: LookupItem[];
  initial?: InitialData;
  isAdmin?: boolean;
}

const ACCESS_LEVEL_OPTIONS = [
  { value: 1, label: "1 - ניהול תחום + עריכה מלאה" },
  { value: 2, label: "2 - ניהול תחום" },
  { value: 3, label: "3 - הנהלה" },
  { value: 4, label: "4 - תפעול שוטף" },
  { value: 5, label: "5 - צפייה בלבד" },
  { value: 6, label: "6 - ללא הרשאה" },
];

const INPUT =
  "w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-gray-50";
const LABEL = "block text-sm font-medium text-gray-700 mb-1";
const BTN_PRIMARY =
  "bg-brand-600 hover:bg-brand-700 text-white rounded-md px-4 py-2 font-medium disabled:opacity-50";
const SECTION = "bg-white rounded-xl shadow p-6 space-y-4";

let keyCounter = 0;
function newKey() {
  keyCounter += 1;
  return `g${keyCounter}-${Date.now()}`;
}

export default function WorkerForm({ mode, workerId, roles, modules, initial, isAdmin }: Props) {
  const router = useRouter();
  const isEdit = mode === "edit";

  const [firstName, setFirstName] = useState(initial?.firstName ?? "");
  const [lastName, setLastName] = useState(initial?.lastName ?? "");
  const [latinFirstName, setLatinFirstName] = useState(initial?.latinFirstName ?? "");
  const [latinLastName, setLatinLastName] = useState(initial?.latinLastName ?? "");
  const [nickname, setNickname] = useState(initial?.nickname ?? "");
  const [language, setLanguage] = useState(initial?.language ?? "עברית");
  const [roleTitle, setRoleTitle] = useState(initial?.roleTitle ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [phone2, setPhone2] = useState(initial?.phone2 ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [email2, setEmail2] = useState(initial?.email2 ?? "");
  const [priorityEmployeeNo, setPriorityEmployeeNo] = useState(initial?.priorityEmployeeNo ?? "");
  const [active, setActive] = useState(initial?.active ?? true);

  const hasAccount = isEdit && initial?.username != null;
  const [username, setUsername] = useState(initial?.username ?? "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [grants, setGrants] = useState<GrantRow[]>(
    (initial?.grants ?? []).map((g) => ({ ...g, key: newKey() }))
  );

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);


  function addGrant() {
    if (modules.length === 0 || roles.length === 0) return;
    setGrants((g) => [
      ...g,
      { key: newKey(), moduleId: modules[0].id, roleId: roles[0].id, accessLevel: 6 },
    ]);
  }

  function updateGrant(key: string, patch: Partial<GrantRow>) {
    setGrants((g) => g.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeGrant(key: string) {
    setGrants((g) => g.filter((row) => row.key !== key));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!hasAccount && (username || password) && !(username && password)) {
      setError("ליצירת חשבון משתמש נדרשים גם שם משתמש וגם סיסמה ראשונית");
      return;
    }

    setLoading(true);
    try {
      const body = {
        firstName,
        lastName,
        latinFirstName,
        latinLastName,
        nickname,
        language,
        roleTitle,
        phone,
        phone2,
        email,
        email2,
        priorityEmployeeNo,
        active,
        grants: grants.map((g) => ({
          moduleId: g.moduleId,
          roleId: g.roleId,
          accessLevel: g.accessLevel,
        })),
        ...(isEdit
          ? { username: username || undefined, newPassword: password || undefined }
          : { username: username || undefined, initialPassword: password || undefined }),
      };

      const url = isEdit ? `/api/admin/workers/${workerId}` : "/api/admin/workers";
      const method = isEdit ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה בשמירה");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    } catch {
      setError("שגיאת תקשורת. נסה שוב.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      <div className={SECTION}>
        <h2 className="font-semibold text-gray-900">פרטי עובד</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>
              שם פרטי <span className="text-red-500">*</span>
            </label>
            <input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>שם משפחה</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>
              שם לטיני (לעובדים תאילנדים)
            </label>
            <input
              value={latinFirstName}
              onChange={(e) => setLatinFirstName(e.target.value)}
              className={INPUT}
              placeholder="First name"
            />
          </div>
          <div>
            <label className={LABEL}>שם משפחה לטיני</label>
            <input
              value={latinLastName}
              onChange={(e) => setLatinLastName(e.target.value)}
              className={INPUT}
              placeholder="Last name"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>כינוי (שם יומיומי)</label>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>שפה</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className={INPUT}>
              <option value="עברית">עברית</option>
              <option value="תאית">תאית</option>
            </select>
          </div>
        </div>

        <div>
          <label className={LABEL}>תפקיד (טקסט חופשי)</label>
          <input
            value={roleTitle}
            onChange={(e) => setRoleTitle(e.target.value)}
            className={INPUT}
            placeholder="לדוגמה: מנהל תפעול"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>טלפון</label>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>טלפון נוסף</label>
            <input value={phone2} onChange={(e) => setPhone2(e.target.value)} className={INPUT} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>דוא&quot;ל</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={INPUT}
            />
          </div>
          <div>
            <label className={LABEL}>דוא&quot;ל נוסף</label>
            <input
              type="email"
              value={email2}
              onChange={(e) => setEmail2(e.target.value)}
              className={INPUT}
            />
          </div>
        </div>

        <div>
          <label className={LABEL}>מספר עובד במערכת Priority</label>
          <input
            value={priorityEmployeeNo}
            onChange={(e) => setPriorityEmployeeNo(e.target.value)}
            className={INPUT}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="rounded border-gray-300"
          />
          עובד פעיל
        </label>
      </div>

      <div className={SECTION}>
        <h2 className="font-semibold text-gray-900">חשבון משתמש</h2>
        {hasAccount ? (
          <p className="text-sm text-gray-500">
            לעובד זה יש חשבון משתמש קיים. ניתן לשנות שם משתמש ולקבוע סיסמה חדשה (השדה נשאר ריק כדי
            להשאיר את הסיסמה הנוכחית).
          </p>
        ) : (
          <p className="text-sm text-gray-500">
            לעובד זה אין עדיין חשבון משתמש. ניתן ליצור אחד עכשיו, או להשאיר ריק וליצור מאוחר יותר.
          </p>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={LABEL}>שם משתמש</label>
            <input value={username} onChange={(e) => setUsername(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className={LABEL}>{hasAccount ? "סיסמה חדשה" : "סיסמה ראשונית"}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={INPUT + " pl-10"}
                placeholder={hasAccount ? "השאר ריק כדי לא לשנות" : ""}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className={SECTION}>
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">הרשאות לפי תחום</h2>
          <button
            type="button"
            onClick={addGrant}
            className="text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            + הוסף הרשאה
          </button>
        </div>

        {grants.length === 0 && (
          <p className="text-sm text-gray-400">אין הרשאות מוגדרות - העובד לא יוכל לגשת לאף תחום.</p>
        )}

        {grants.map((row) => (
          <div key={row.key} className="flex items-end gap-3 border-b border-gray-100 pb-3">
            <div className="flex-1">
              <label className={LABEL}>תחום</label>
              <select
                value={row.moduleId}
                onChange={(e) => updateGrant(row.key, { moduleId: e.target.value })}
                className={INPUT}
              >
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={LABEL}>תפקיד</label>
              <select
                value={row.roleId}
                onChange={(e) => updateGrant(row.key, { roleId: e.target.value })}
                className={INPUT}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className={LABEL}>רמת הרשאה</label>
              <select
                value={row.accessLevel}
                onChange={(e) => updateGrant(row.key, { accessLevel: Number(e.target.value) })}
                className={INPUT}
              >
                {ACCESS_LEVEL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => removeGrant(row.key)}
              className="text-red-500 hover:text-red-700 px-2 py-2"
              aria-label="הסר הרשאה"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {isEdit && isAdmin && workerId && (
        <div className={SECTION}>
          <h2 className="font-semibold text-gray-900">חתימה דיגיטלית</h2>
          <p className="text-sm text-gray-500">
            החתימה תשמש לאישור תעודות משלוח. צייר את החתימה עם העכבר או האצבע.
          </p>
          <SignaturePad workerId={workerId} hasExistingSignature={initial?.hasSignature ?? false} />
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className={BTN_PRIMARY}>
          {loading ? "שומר..." : isEdit ? "שמור שינויים" : "צור עובד"}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          ביטול
        </button>
      </div>
    </form>
  );
}
