"use client";
import React from "react";

export const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface2)",
  border: "var(--border)",
  gold: "var(--gold)",
  goldSoft: "var(--gold-soft)",
  red: "var(--red)",
  green: "var(--green)",
  text: "var(--text)",
  muted: "var(--muted)",
};

/* لۆگۆی خۆری ڕۆژ — ٢١ تیشک */
export function Sun({ size = 44 }) {
  const rays = [];
  for (let i = 0; i < 21; i++) {
    rays.push(
      <line
        key={i}
        x1="50" y1="14" x2="50" y2="26"
        stroke="var(--gold)" strokeWidth="4.5" strokeLinecap="round"
        transform={`rotate(${(i * 360) / 21} 50 50)`}
      />
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="50" r="17" fill="var(--gold)" />
      {rays}
    </svg>
  );
}

export function Avatar({ name, size = 44, ring = null, dim = false }) {
  const initial = (name || "؟").trim().charAt(0);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%",
        background: C.surface2,
        border: ring ? `3px solid ${ring}` : `2px solid ${C.border}`,
        color: dim ? C.muted : C.gold,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: size * 0.42, fontWeight: 700, flexShrink: 0,
        boxShadow: ring ? `0 0 14px rgba(232,179,60,0.4)` : "none",
        transition: "box-shadow .3s, border-color .3s",
      }}
    >
      {initial}
    </div>
  );
}

export function Btn({ children, onClick, kind = "gold", disabled, style = {}, small }) {
  const kinds = {
    gold: { background: C.gold, color: "#1A1508", border: "none" },
    ghost: { background: "transparent", color: C.text, border: `1px solid ${C.border}` },
    red: { background: C.red, color: "#fff", border: "none" },
    green: { background: C.green, color: "#0B1A12", border: "none" },
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        ...kinds[kind],
        borderRadius: 12,
        padding: small ? "7px 14px" : "12px 20px",
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.45 : 1,
        fontFamily: "inherit",
        ...style,
      }}
    >
      {children}
    </button>
  );
}

export function Input(props) {
  return (
    <input
      {...props}
      style={{
        width: "100%",
        background: C.surface2,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "12px 14px",
        color: C.text,
        fontSize: 15,
        fontFamily: "inherit",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

export const timeStr = (t) =>
  new Date(t).toLocaleTimeString("ckb-IQ", { hour: "2-digit", minute: "2-digit" });
