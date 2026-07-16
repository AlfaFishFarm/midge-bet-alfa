"use client";

import { useRouter } from "next/navigation";

interface DateNavProps {
  date: string;         // yyyy-mm-dd
  basePath?: string;    // where to push on change, default "/reports/daily-summary"
}

// Prototype: ds-date-picker input style:
// padding:6px 10px; border:1.5px solid #e5e7eb; border-radius:7px;
// font-size:13px; font-family:inherit; color:#1a2744; outline:none
export default function DateNav({ date, basePath = "/reports/daily-summary" }: DateNavProps) {
  const router = useRouter();

  return (
    <input
      id="summary-date"
      type="date"
      defaultValue={date}
      onChange={(e) => {
        if (e.target.value) {
          const sep = basePath.includes("?") ? "&" : "?";
          router.push(`${basePath}${sep}date=${e.target.value}`);
        }
      }}
      style={{
        padding: "6px 10px",
        border: "1.5px solid #e5e7eb",
        borderRadius: "7px",
        fontSize: "13px",
        fontFamily: "inherit",
        color: "#1a2744",
        outline: "none",
      }}
    />
  );
}
