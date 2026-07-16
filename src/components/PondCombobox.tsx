"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

interface PondOption {
  id: string;
  code: string | null;
  name: string;
  disabled?: boolean;
}

interface Props<P extends PondOption = PondOption> {
  ponds: P[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  className?: string;
  inputStyle?: React.CSSProperties;
  panelStyle?: React.CSSProperties;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  labelExtra?: (pond: P) => string | null | undefined;
}

export default function PondCombobox<P extends PondOption = PondOption>({
  ponds,
  value,
  onChange,
  placeholder = "חפש בריכה...",
  className,
  inputStyle,
  panelStyle,
  required,
  disabled,
  id,
  labelExtra,
}: Props<P>) {
  const reactId = useId();
  const inputId = id ?? reactId;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => ponds.find((p) => p.id === value) ?? null, [ponds, value]);

  useEffect(() => {
    if (!open) setQuery(selected ? selected.name : "");
  }, [selected, open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ponds;
    return ponds.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.code ?? "").toLowerCase().includes(q)
    );
  }, [ponds, query]);

  useEffect(() => {
    if (!wrapRef.current) return;
    function onDocClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected ? selected.name : "");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [selected]);

  function pick(p: P) {
    if (p.disabled) return;
    onChange(p.id);
    setQuery(p.name);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[highlight] && !filtered[highlight].disabled) pick(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(selected ? selected.name : "");
    }
  }

  const listboxId = `${inputId}-listbox`;

  const resolvedInputStyle: React.CSSProperties | undefined = inputStyle
    ? {
        ...inputStyle,
        ...(value
          ? { borderColor: "#2BAEA6", background: "#f0fdfc", color: "#1a2744", fontWeight: 600 }
          : {}),
        ...(open
          ? { borderColor: "#2BAEA6", borderRadius: "8px 8px 0 0" }
          : {}),
      }
    : undefined;

  const usePfPanel = !!inputStyle;

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        id={inputId}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={placeholder}
        className={className}
        style={resolvedInputStyle}
        onChange={(e) => {
          setQuery(e.target.value);
          setHighlight(0);
          setOpen(true);
          if (!e.target.value) onChange("");
        }}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listboxId}
      />
      {required && <input type="hidden" value={value} required />}
      {open && (
        usePfPanel ? (
          <ul
            id={listboxId}
            role="listbox"
            style={{
              display: "block",
              position: "absolute",
              top: "100%",
              right: 0,
              left: 0,
              background: "white",
              border: "1.5px solid #2BAEA6",
              borderTop: "none",
              borderRadius: "0 0 10px 10px",
              zIndex: 500,
              maxHeight: 220,
              overflowY: "auto",
              boxShadow: "0 8px 20px rgba(0,0,0,0.12)",
              margin: 0,
              padding: 0,
              listStyle: "none",
              ...panelStyle,
            }}
          >
            {filtered.length === 0 ? (
              <li style={{ padding: "10px 14px", fontSize: 13, color: "#9ca3af" }}>
                לא נמצאו בריכות מתאימות
              </li>
            ) : (
              filtered.map((p, i) => {
                const extra = labelExtra?.(p);
                const badgeBg =
                  extra === "פתוחה" ? "#fef3c7" :
                  extra === "סגורה" ? "#dcfce7" : "#f3f4f6";
                const badgeColor =
                  extra === "פתוחה" ? "#92400e" :
                  extra === "סגורה" ? "#15803d" : "#6b7280";
                return (
                  <li
                    key={p.id}
                    role="option"
                    aria-selected={p.id === value}
                    aria-disabled={p.disabled}
                    onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                    onMouseEnter={() => !p.disabled && setHighlight(i)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      cursor: p.disabled ? "not-allowed" : "pointer",
                      fontSize: 13,
                      fontWeight: p.id === value ? 700 : 600,
                      color: p.disabled ? "#9ca3af" : "#1a2744",
                      background: p.disabled ? "#fafafa" : i === highlight ? "#f0fdf4" : "white",
                      borderBottom: "1px solid #f3f4f6",
                      opacity: p.disabled ? 0.6 : 1,
                    }}
                  >
                    <span>
                      {p.name}
                      {p.code && (
                        <span style={{ fontSize: 11, fontWeight: 400, color: "#6b7280", marginRight: 6 }}>
                          {" "}&middot; {p.code}
                        </span>
                      )}
                    </span>
                    {extra && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "2px 9px",
                        borderRadius: 10, flexShrink: 0, marginRight: 8,
                        background: badgeBg, color: badgeColor,
                      }}>
                        {extra}
                      </span>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        ) : (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg text-sm"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-gray-400">לא נמצאו בריכות מתאימות</li>
            ) : (
              filtered.map((p, i) => {
                const extra = labelExtra?.(p);
                return (
                  <li
                    key={p.id}
                    role="option"
                    aria-selected={p.id === value}
                    aria-disabled={p.disabled}
                    onMouseDown={(e) => { e.preventDefault(); pick(p); }}
                    onMouseEnter={() => !p.disabled && setHighlight(i)}
                    className={[
                      "px-3 py-2",
                      p.disabled ? "cursor-not-allowed opacity-50 text-gray-400" : "cursor-pointer",
                      !p.disabled && i === highlight ? "bg-brand-50 text-brand-700" : !p.disabled ? "hover:bg-gray-50" : "",
                      p.id === value ? "font-semibold" : "",
                    ].join(" ")}
                  >
                    {p.name}
                    {p.code && <span className="text-gray-400 mr-1"> &middot; {p.code}</span>}
                    {extra && <span className="text-gray-400"> {extra}</span>}
                  </li>
                );
              })
            )}
          </ul>
        )
      )}
    </div>
  );
}
