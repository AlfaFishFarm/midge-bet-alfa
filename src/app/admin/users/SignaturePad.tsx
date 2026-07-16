"use client";

import { useRef, useEffect, useState, useCallback } from "react";

interface Props {
  workerId: string;
  hasExistingSignature: boolean;
}

export default function SignaturePad({ workerId, hasExistingSignature }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);
  const [showExisting, setShowExisting] = useState(hasExistingSignature);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [sigCacheBust, setSigCacheBust] = useState(Date.now());
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#1a2b1f";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const t = e.touches[0];
      return { x: (t.clientX - rect.left) * scaleX, y: (t.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    setDrawing(true);
    setHasStrokes(true);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 1, 0, Math.PI * 2);
    ctx.fill();
  }, []);

  const draw = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas || !lastPos.current) return;
    const pos = getPos(e, canvas);
    const ctx = getCtx();
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }, [drawing]);

  const endDraw = useCallback(() => {
    setDrawing(false);
    lastPos.current = null;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener("mousedown", startDraw);
    canvas.addEventListener("mousemove", draw);
    canvas.addEventListener("mouseup", endDraw);
    canvas.addEventListener("mouseleave", endDraw);
    canvas.addEventListener("touchstart", startDraw, { passive: false });
    canvas.addEventListener("touchmove", draw, { passive: false });
    canvas.addEventListener("touchend", endDraw);
    return () => {
      canvas.removeEventListener("mousedown", startDraw);
      canvas.removeEventListener("mousemove", draw);
      canvas.removeEventListener("mouseup", endDraw);
      canvas.removeEventListener("mouseleave", endDraw);
      canvas.removeEventListener("touchstart", startDraw);
      canvas.removeEventListener("touchmove", draw);
      canvas.removeEventListener("touchend", endDraw);
    };
  }, [startDraw, draw, endDraw]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
    setError(null);
    setSuccess(null);
  }

  async function saveSignature() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStrokes) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("canvas empty"))), "image/png")
      );
      const fd = new FormData();
      fd.append("file", blob, "signature.png");
      const r = await fetch(`/api/admin/workers/${workerId}/signature`, { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "שגיאה בשמירה"); return; }
      setShowExisting(true);
      setSigCacheBust(Date.now());
      clearCanvas();
      setSuccess("החתימה נשמרה בהצלחה ✓");
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError("שגיאת תקשורת"); }
    finally { setSaving(false); }
  }

  async function deleteSignature() {
    if (!confirm("למחוק את החתימה הדיגיטלית?")) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch(`/api/admin/workers/${workerId}/signature`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); setError(d.error ?? "שגיאה"); return; }
      setShowExisting(false);
      setSuccess("החתימה נמחקה");
      setTimeout(() => setSuccess(null), 3000);
    } catch { setError("שגיאת תקשורת"); }
    finally { setSaving(false); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* existing signature preview */}
      {showExisting && (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 8, background: "#f9f6f0" }}>
            <img
              src={`/api/admin/workers/${workerId}/signature?t=${sigCacheBust}`}
              alt="חתימה נוכחית"
              style={{ maxHeight: 72, maxWidth: 220, objectFit: "contain", display: "block" }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, color: "#6b7280" }}>חתימה נוכחית</span>
            <button
              type="button"
              onClick={deleteSignature}
              disabled={saving}
              style={{ fontSize: 12, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "right" }}
            >
              מחק חתימה
            </button>
          </div>
        </div>
      )}

      {/* drawing pad */}
      <div>
        <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
          {showExisting ? "צייר חתימה חדשה כדי להחליף:" : "צייר את החתימה שלך:"}
        </p>
        <canvas
          ref={canvasRef}
          width={400}
          height={140}
          style={{
            border: "1.5px solid #d1d5db",
            borderRadius: 8,
            background: "white",
            cursor: "crosshair",
            display: "block",
            width: "100%",
            maxWidth: 400,
            touchAction: "none",
          }}
        />
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button
            type="button"
            onClick={clearCanvas}
            disabled={saving}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1.5px solid #d1d5db", background: "white", fontSize: 13, cursor: "pointer", color: "#374151" }}
          >
            נקה
          </button>
          <button
            type="button"
            onClick={saveSignature}
            disabled={!hasStrokes || saving}
            style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: hasStrokes && !saving ? "#1B3A2B" : "#d1d5db", color: "white", fontSize: 13, fontWeight: 700, cursor: hasStrokes && !saving ? "pointer" : "not-allowed" }}
          >
            {saving ? "שומר..." : "שמור חתימה"}
          </button>
        </div>
      </div>

      {error && <p style={{ fontSize: 13, color: "#dc2626", background: "#fef2f2", borderRadius: 6, padding: "8px 12px", margin: 0 }}>{error}</p>}
      {success && <p style={{ fontSize: 13, color: "#16a34a", background: "#f0fdf4", borderRadius: 6, padding: "8px 12px", margin: 0 }}>{success}</p>}
    </div>
  );
}
