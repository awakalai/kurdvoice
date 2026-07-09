"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { supabase, getLiveKitToken, pairRoom } from "@/lib/supabase";
import { C, Avatar, Btn, Input, timeStr } from "./ui";

/* ============ تابی هاوڕێکان ============ */
export function FriendsTab({ me, profiles, friendships, refreshSocial, onToast, onChat, onCall }) {
  const [q, setQ] = useState("");

  const incoming = friendships.filter((f) => f.addressee_id === me.id && f.status === "pending");
  const sentByMe = friendships.filter((f) => f.requester_id === me.id && f.status === "pending").map((f) => f.addressee_id);
  const friendIds = friendships
    .filter((f) => f.status === "accepted")
    .map((f) => (f.requester_id === me.id ? f.addressee_id : f.requester_id));
  const isFriend = (id) => friendIds.includes(id);

  const results = q.trim()
    ? Object.values(profiles).filter((p) => p.id !== me.id && p.display_name.includes(q.trim()))
    : [];

  const sendRequest = async (to) => {
    const { error } = await supabase.from("friendships").insert({ requester_id: me.id, addressee_id: to });
    if (!error) {
      onToast("داواکاری نێردرا");
      refreshSocial();
    }
  };
  const accept = async (fid) => {
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", fid);
    refreshSocial();
  };
  const reject = async (fid) => {
    await supabase.from("friendships").delete().eq("id", fid);
    refreshSocial();
  };

  const Row = ({ p, children }) => (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 12 }}>
      <Avatar name={p.display_name} size={42} />
      <div style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14 }}>{p.display_name}</div>
      {children}
    </div>
  );

  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <Input placeholder="🔍 گەڕان بە ناو..." value={q} onChange={(e) => setQ(e.target.value)} />

      {results.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 14, color: C.muted, margin: 0 }}>ئەنجامی گەڕان</h3>
          {results.map((p) => (
            <Row key={p.id} p={p}>
              {isFriend(p.id) ? (
                <span style={{ color: C.green, fontSize: 12 }}>✓ هاوڕێن</span>
              ) : sentByMe.includes(p.id) ? (
                <span style={{ color: C.muted, fontSize: 12 }}>نێردراوە</span>
              ) : (
                <Btn small onClick={() => sendRequest(p.id)}>+ ئاد</Btn>
              )}
            </Row>
          ))}
        </section>
      )}

      {incoming.length > 0 && (
        <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h3 style={{ fontSize: 14, color: C.gold, margin: 0 }}>داواکارییە نوێیەکان ({incoming.length})</h3>
          {incoming.map((f) => {
            const p = profiles[f.requester_id];
            if (!p) return null;
            return (
              <Row key={f.id} p={p}>
                <Btn small kind="green" onClick={() => accept(f.id)}>قبووڵ</Btn>
                <Btn small kind="ghost" onClick={() => reject(f.id)}>ڕەت</Btn>
              </Row>
            );
          })}
        </section>
      )}

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <h3 style={{ fontSize: 14, color: C.muted, margin: 0 }}>هاوڕێکانم ({friendIds.length})</h3>
        {friendIds.length === 0 && (
          <div style={{ textAlign: "center", color: C.muted, padding: "24px 0", fontSize: 13 }}>
            هێشتا هاوڕێت نییە — لە سەرەوە بگەڕێ و ئادیان بکە 👆
          </div>
        )}
        {friendIds.map((id) => {
          const p = profiles[id];
          if (!p) return null;
          return (
            <Row key={id} p={p}>
              <Btn small kind="ghost" onClick={() => onChat(id)}>💬</Btn>
              <Btn small onClick={() => onCall(id)}>📞</Btn>
            </Row>
          );
        })}
      </section>
    </div>
  );
}

/* ============ چاتی تایبەت ============ */
export function DMView({ me, other, onToast, onCall, onClose }) {
  const [msgs, setMsgs] = useState([]);
  const [msg, setMsg] = useState("");
  const endRef = useRef(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("dm_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${me.id},recipient_id.eq.${other.id}),and(sender_id.eq.${other.id},recipient_id.eq.${me.id})`
      )
      .order("created_at", { ascending: true })
      .limit(200);
    if (data) setMsgs(data);
  }, [me.id, other.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("dm-" + pairRoom(me.id, other.id))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "dm_messages" }, (p) => {
        const m = p.new;
        if (
          (m.sender_id === me.id && m.recipient_id === other.id) ||
          (m.sender_id === other.id && m.recipient_id === me.id)
        )
          setMsgs((x) => (x.some((y) => y.id === m.id) ? x : [...x, m]));
      })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [load, me.id, other.id]);

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  const send = async () => {
    if (!msg.trim()) return;
    const t = msg.trim();
    setMsg("");
    await supabase.from("dm_messages").insert({ sender_id: me.id, recipient_id: other.id, text: t });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 30, display: "flex", flexDirection: "column", maxWidth: 560, margin: "0 auto" }} dir="rtl">
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <button onClick={onClose} style={{ background: "none", border: "none", color: C.gold, fontSize: 20, cursor: "pointer" }}>→</button>
        <Avatar name={other.display_name} size={36} />
        <div style={{ flex: 1, fontWeight: 700 }}>{other.display_name}</div>
        <Btn small onClick={onCall}>📞 پەیوەندی</Btn>
      </header>

      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>دەستپێبکە بە یەکەم نامە 💬</div>}
        {msgs.map((m) => {
          const mine = m.sender_id === me.id;
          const isCall = m.kind === "call";
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-start" : "flex-end", maxWidth: "80%" }}>
              <div
                style={{
                  background: isCall ? "transparent" : mine ? C.goldSoft : C.surface2,
                  border: `1px solid ${isCall ? C.border : mine ? "rgba(232,179,60,0.35)" : C.border}`,
                  borderRadius: 14,
                  padding: "8px 12px",
                  fontStyle: isCall ? "italic" : "normal",
                  color: isCall ? C.muted : C.text,
                }}
              >
                <div style={{ fontSize: 14 }}>{m.text}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{timeStr(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <Input placeholder="نامەیەک بنووسە..." value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <Btn small onClick={send}>ناردن</Btn>
      </div>
    </div>
  );
}

/* ============ پەیوەندی دەنگی ڕاستەقینە (تاکەکەسی) ============ */
export function CallView({ me, other, onToast, onEnd }) {
  const [status, setStatus] = useState("connecting"); // connecting | on
  const [sec, setSec] = useState(0);
  const [otherJoined, setOtherJoined] = useState(false);
  const lkRoom = useRef(null);
  const audioBox = useRef(null);

  useEffect(() => {
    let iv;
    (async () => {
      try {
        const roomName = pairRoom(me.id, other.id);
        const token = await getLiveKitToken(roomName);
        const r = new Room();
        r.on(RoomEvent.TrackSubscribed, (track) => {
          if (track.kind === "audio" && audioBox.current) audioBox.current.appendChild(track.attach());
        });
        r.on(RoomEvent.ParticipantConnected, () => setOtherJoined(true));
        r.on(RoomEvent.ParticipantDisconnected, () => {
          onToast("پەیوەندییەکە کۆتایی هات");
          hangup();
        });
        await r.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token);
        await r.localParticipant.setMicrophoneEnabled(true);
        lkRoom.current = r;
        setStatus("on");
        setOtherJoined(r.remoteParticipants.size > 0);
        // ئاگادارکردنەوەی لایەنی بەرامبەر لە ڕێگەی چاتەوە
        await supabase.from("dm_messages").insert({
          sender_id: me.id,
          recipient_id: other.id,
          text: "📞 بانگم کردیت — دوگمەی پەیوەندی دابگرە بۆ وەڵامدانەوە",
          kind: "call",
        });
        iv = setInterval(() => setSec((s) => s + 1), 1000);
      } catch {
        onToast("پەیوەندی سەرکەوتوو نەبوو");
        onEnd();
      }
    })();
    return () => {
      if (iv) clearInterval(iv);
      if (lkRoom.current) lkRoom.current.disconnect();
    };
  }, []); // eslint-disable-line

  const hangup = () => {
    if (lkRoom.current) lkRoom.current.disconnect();
    onEnd();
  };

  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");

  return (
    <div
      dir="rtl"
      style={{
        position: "fixed", inset: 0, zIndex: 50,
        background: "rgba(10,16,13,0.97)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 18, maxWidth: 560, margin: "0 auto",
      }}
    >
      <div ref={audioBox} style={{ display: "none" }} />
      <div style={{ animation: otherJoined ? "none" : "pulse 1.6s infinite" }}>
        <Avatar name={other.display_name} size={110} ring="var(--gold)" />
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'Reem Kufi', sans-serif" }}>{other.display_name}</div>
      <div style={{ color: otherJoined ? C.green : C.gold, fontSize: 15, fontWeight: 700 }}>
        {status === "connecting" ? "پەیوەستبوون..." : otherJoined ? `🟢 لەسەر هێڵە · ${mm}:${ss}` : "📞 بانگکردن... چاوەڕوانی وەڵام"}
      </div>
      {!otherJoined && status === "on" && (
        <p style={{ color: C.muted, fontSize: 12, textAlign: "center", maxWidth: 280 }}>
          ئاگادارکردنەوەیەک لە چاتەکەیدا بۆی نێردرا
        </p>
      )}
      <Btn kind="red" onClick={hangup} style={{ borderRadius: 999, width: 68, height: 68, fontSize: 26 }}>📵</Btn>
    </div>
  );
}
