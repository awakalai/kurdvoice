"use client";
import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { C, Sun, Avatar, Btn, Input } from "@/components/ui";
import AuthScreen from "@/components/AuthScreen";
import RoomView from "@/components/RoomView";
import { FriendsTab, DMView, CallView } from "@/components/FriendsTab";

export default function Page() {
  const [booted, setBooted] = useState(false);
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState("rooms");
  const [profiles, setProfiles] = useState({});
  const [rooms, setRooms] = useState([]);
  const [friendships, setFriendships] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [dmWith, setDmWith] = useState(null);
  const [callWith, setCallWith] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (m) => {
    setToast(m);
    setTimeout(() => setToast(null), 3000);
  };

  /* ---- سێشن ---- */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) loadMe(data.session.user.id);
      else setBooted(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) loadMe(session.user.id);
      else {
        setMe(null);
        setBooted(true);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []); // eslint-disable-line

  const loadMe = async (uid) => {
    // پرۆفایلەکە لەوانەیە چەند خولەکێک دوابکەوێت دوای خۆتۆمارکردن — چەند جارێک هەوڵ بدە
    for (let i = 0; i < 5; i++) {
      const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (data) {
        setMe(data);
        setBooted(true);
        return;
      }
      await new Promise((r) => setTimeout(r, 800));
    }
    setBooted(true);
  };

  /* ---- داتای گشتی ---- */
  const refreshAll = useCallback(async () => {
    if (!me) return;
    const [p, r, f] = await Promise.all([
      supabase.from("profiles").select("*"),
      supabase.from("rooms").select("*").order("created_at", { ascending: false }),
      supabase.from("friendships").select("*").or(`requester_id.eq.${me.id},addressee_id.eq.${me.id}`),
    ]);
    if (p.data) setProfiles(Object.fromEntries(p.data.map((x) => [x.id, x])));
    if (r.data) setRooms(r.data);
    if (f.data) setFriendships(f.data);
  }, [me]);

  useEffect(() => {
    if (!me) return;
    refreshAll();
    const ch = supabase
      .channel("global")
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, refreshAll)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profiles" }, refreshAll)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [me, refreshAll]);

  /* ================= ڕووکار ================= */
  const Shell = ({ children }) => (
    <div dir="rtl" style={{ minHeight: "100vh", maxWidth: 560, margin: "0 auto", display: "flex", flexDirection: "column", position: "relative" }}>
      {children}
      {toast && (
        <div
          style={{
            position: "fixed", bottom: 96, insetInlineStart: "50%", transform: "translateX(50%)",
            background: C.surface2, border: `1px solid ${C.gold}`, color: C.text,
            padding: "10px 18px", borderRadius: 14, fontSize: 14, zIndex: 60, maxWidth: "88vw", textAlign: "center",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );

  if (!booted)
    return (
      <Shell>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", gap: 16 }}>
          <Sun size={72} />
          <div style={{ color: C.muted }}>بارکردن...</div>
        </div>
      </Shell>
    );

  if (!me)
    return (
      <Shell>
        <AuthScreen onToast={showToast} />
      </Shell>
    );

  const incoming = friendships.filter((f) => f.addressee_id === me.id && f.status === "pending").length;

  return (
    <Shell>
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: `1px solid ${C.border}`, background: C.surface, position: "sticky", top: 0, zIndex: 5 }}>
        <Sun size={30} />
        <div style={{ fontFamily: "'Reem Kufi', sans-serif", fontSize: 20, fontWeight: 700, color: C.gold }}>کورد ڤۆیس</div>
        <div style={{ marginInlineStart: "auto", color: C.muted, fontSize: 13 }}>{me.display_name}</div>
      </header>

      <main style={{ flex: 1, overflowY: "auto", paddingBottom: 84 }}>
        {tab === "rooms" && <RoomsTab me={me} rooms={rooms} profiles={profiles} onEnter={setActiveRoom} onToast={showToast} />}
        {tab === "friends" && (
          <FriendsTab
            me={me}
            profiles={profiles}
            friendships={friendships}
            refreshSocial={refreshAll}
            onToast={showToast}
            onChat={(id) => setDmWith(id)}
            onCall={(id) => setCallWith(id)}
          />
        )}
        {tab === "profile" && <ProfileTab me={me} profiles={profiles} friendships={friendships} />}
      </main>

      <nav style={{ position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, display: "flex", background: C.surface, borderTop: `1px solid ${C.border}`, zIndex: 5, maxWidth: 560, margin: "0 auto" }}>
        {[
          ["rooms", "🎙️", "ڕوومەکان", 0],
          ["friends", "👥", "هاوڕێکان", incoming],
          ["profile", "☀️", "پرۆفایل", 0],
        ].map(([id, icon, label, badge]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{ flex: 1, background: "none", border: "none", padding: "10px 0 12px", color: tab === id ? C.gold : C.muted, fontFamily: "inherit", fontSize: 12, cursor: "pointer", position: "relative" }}
          >
            <div style={{ fontSize: 20 }}>{icon}</div>
            {label}
            {badge > 0 && (
              <span style={{ position: "absolute", top: 6, insetInlineEnd: "28%", background: C.red, color: "#fff", borderRadius: 999, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>
                {badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {activeRoom && (
        <RoomView
          room={activeRoom}
          me={me}
          profiles={profiles}
          onToast={showToast}
          onLeave={() => setActiveRoom(null)}
          onDeleted={() => setActiveRoom(null)}
        />
      )}
      {dmWith && profiles[dmWith] && (
        <DMView me={me} other={profiles[dmWith]} onToast={showToast} onCall={() => setCallWith(dmWith)} onClose={() => setDmWith(null)} />
      )}
      {callWith && profiles[callWith] && (
        <CallView me={me} other={profiles[callWith]} onToast={showToast} onEnd={() => setCallWith(null)} />
      )}
    </Shell>
  );
}

/* ---------- تابی ڕوومەکان ---------- */
function RoomsTab({ me, rooms, profiles, onEnter, onToast }) {
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [topic, setTopic] = useState("");

  const create = async () => {
    if (!name.trim()) return onToast("ناوی ڕووم بنووسە");
    const { data, error } = await supabase
      .from("rooms")
      .insert({ name: name.trim(), topic: topic.trim(), admin_id: me.id })
      .select()
      .single();
    if (error || !data) return onToast("دروستکردنی ڕووم سەرکەوتوو نەبوو");
    setName("");
    setTopic("");
    setShow(false);
    onEnter(data);
  };

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontFamily: "'Reem Kufi', sans-serif", fontSize: 20, margin: 0 }}>ڕوومە کراوەکان</h2>
        <Btn small onClick={() => setShow(!show)}>{show ? "داخستن" : "+ ڕوومی نوێ"}</Btn>
      </div>

      {show && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <Input placeholder="ناوی ڕووم — بۆ نموونە: باسی هەولێر" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="بابەت (ئارەزوومەندانە)" value={topic} onChange={(e) => setTopic(e.target.value)} />
          <Btn onClick={create}>کردنەوەی ڕووم 🎙️</Btn>
        </div>
      )}

      {rooms.length === 0 && (
        <div style={{ textAlign: "center", color: C.muted, padding: "48px 0" }}>
          <div style={{ fontSize: 40 }}>🌄</div>
          هێشتا هیچ ڕوومێک نییە — یەکەم کەس بە کە ڕوومێک دەکاتەوە!
        </div>
      )}

      {rooms.map((r) => (
        <button
          key={r.id}
          onClick={() => onEnter(r)}
          style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, cursor: "pointer", textAlign: "start", fontFamily: "inherit", color: C.text }}
        >
          <div style={{ width: 46, height: 46, borderRadius: 14, background: C.goldSoft, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
            🎙️
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{r.name}</div>
            <div style={{ color: C.muted, fontSize: 12, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {r.topic || "بێ بابەت"} · ئەدمین: {profiles[r.admin_id] ? profiles[r.admin_id].display_name : "..."}
              {r.admin_id === me.id ? " (تۆ)" : ""}
            </div>
          </div>
          <div style={{ color: C.gold, fontSize: 13, fontWeight: 700 }}>جۆین ←</div>
        </button>
      ))}
    </div>
  );
}

/* ---------- تابی پرۆفایل ---------- */
function ProfileTab({ me, profiles, friendships }) {
  const friendCount = friendships.filter((f) => f.status === "accepted").length;
  const totalUsers = Object.keys(profiles).length;
  const birthStr = me.birth_date
    ? new Date(me.birth_date).toLocaleDateString("ckb-IQ", { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <Avatar name={me.display_name} size={92} ring="var(--gold)" />
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Reem Kufi', sans-serif" }}>{me.display_name}</div>
      {birthStr && <div style={{ color: C.muted, fontSize: 12 }}>🎂 لەدایکبووی {birthStr}</div>}

      <div style={{ display: "flex", gap: 10, width: "100%", marginTop: 8 }}>
        {[
          [friendCount, "هاوڕێ"],
          [totalUsers, "ئەندامی کورد ڤۆیس"],
        ].map(([n, label]) => (
          <div key={label} style={{ flex: 1, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, textAlign: "center" }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: C.gold }}>{n}</div>
            <div style={{ fontSize: 12, color: C.muted }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, width: "100%", fontSize: 13, color: C.muted, lineHeight: 1.9 }}>
        <span style={{ color: C.gold, fontWeight: 700 }}>☀️ ئامانجی کورد ڤۆیس:</span>
        <br />
        کوردانی هەموو جیهان — لە کوردستانەوە تا ئەورووپا و ئەمریکا — لە یەک شوێندا کۆببنەوە، قسە بکەن، هاوڕێیەتی دروست بکەن و دەنگیان بگاتە یەکتری.
      </div>

      <Btn kind="ghost" onClick={() => supabase.auth.signOut()} style={{ width: "100%", marginTop: 6 }}>
        چوونەدەرەوە
      </Btn>
    </div>
  );
}
