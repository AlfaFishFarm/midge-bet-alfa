import { Suspense } from "react";
import PondStatusClient from "./PondStatusClient";

export default function PondStatusPage() {
  return (
    <Suspense fallback={<div style={{ padding: 32, color: "#6b7280" }}>טוען...</div>}>
      <PondStatusClient />
    </Suspense>
  );
}
