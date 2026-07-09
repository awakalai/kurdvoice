"use client";
import React, { useState } from "react";
import { supabase } from "@/lib/supabase";
import { C, Sun, Btn, Input } from "./ui";

export default function AuthScreen({ onToast }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [birth, setBirth] = useState("");
  const [p, setP] = useState("");
  const [busy, setBusy] = useState(false);

  const Label = ({ children }) => (
    <div style={{ fontSize: 12, color: C.muted, marginBottom: -7 }}>{children}</div>
  );

  const submit = async () => {
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: p });
        if (error) onToast("ئیمەیڵ یان وشەی نهێنی هەڵەیە");
      } else {
        if (!first.trim() || !last.trim()) return onToast("ناو و ناوی خانەوادە بنووسە");
        if (!birth) return onToast("بەرواری لەدایکبوون هەڵبژێرە");
        const age = (Date.now() - new Date(birth).getTime()) / 31557600000;
        if (isNaN(age) || age > 120) return onToast("بەرواری لەدایکبوون دروست نییە");
        if (age < 13) return onToast("دەبێت تەمەنت ١٣ ساڵ یان زیاتر بێت");
        if (p.length < 6) return onToast("وشەی نهێنی لانیکەم ٦ پیت بێت");
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password: p,
          options: {
            data: { first_name: first.trim(), last_name: last.trim(), birth_date: birth },
          },
        });
        if (error) onToast(error.message.includes("already") ? "ئەم ئیمەیڵە پێشتر تۆمارکراوە" : "هەڵەیەک ڕوویدا");
        else onToast("ئەکاونتەکەت دروستکرا! ☀️ (ئەگەر پشتڕاستکردنەوە داواکرا، ئیمەیڵەکەت بپشکنە)");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", minHeight: "100vh", padding: 28, gap: 13, maxWidth: 460, margin: "0 auto" }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Sun size={80} />
        <h1 style={{ fontFamily: "'Reem Kufi', sans-serif", color: C.gold, fontSize: 34, margin: "10px 0 4px" }}>کورد ڤۆیس</h1>
        <p style={{ color: C.muted, fontSize: 14, margin: 0 }}>دەنگی کوردانی هەموو جیهان — لە یەک شوێن</p>
      </div>

      <div style={{ display: "flex", gap: 8, background: C.surface, padding: 5, borderRadius: 14 }}>
        {[["login", "چوونەژوورەوە"], ["register", "خۆتۆمارکردن"]].map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, padding: 10, borderRadius: 10, border: "none",
              background: mode === m ? C.gold : "transparent",
              color: mode === m ? "#1A1508" : C.muted,
              fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <Label>ئیمەیڵ</Label>
      <Input placeholder="name@email.com" value={email} onChange={(e) => setEmail(e.target.value)} dir="ltr" inputMode="email" />

      {mode === "register" && (
        <>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13 }}>
              <Label>ناوی خۆت</Label>
              <Input placeholder="بۆ نموونە: ئاڵا" value={first} onChange={(e) => setFirst(e.target.value)} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 13 }}>
              <Label>ناوی خانەوادە</Label>
              <Input placeholder="بۆ نموونە: بەرزنجی" value={last} onChange={(e) => setLast(e.target.value)} />
            </div>
          </div>
          <Label>بەرواری لەدایکبوون</Label>
          <Input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} dir="ltr" style={{ colorScheme: "dark" }} />
        </>
      )}

      <Label>وشەی نهێنی</Label>
      <Input placeholder="••••••••" type="password" value={p} onChange={(e) => setP(e.target.value)} dir="ltr" />

      <Btn onClick={submit} disabled={busy} style={{ marginTop: 4 }}>
        {busy ? "..." : mode === "login" ? "چوونەژوورەوە" : "دروستکردنی ئەکاونت ☀️"}
      </Btn>
      <p style={{ color: C.muted, fontSize: 12, textAlign: "center", margin: 0 }}>
        بە دروستکردنی ئەکاونت، ڕازیت بە بەکارهێنانی ڕێزدارانەی پلاتفۆرمەکە
      </p>
    </div>
  );
}
