"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent } from "livekit-client";
import { supabase, getLiveKitToken } from "@/lib/supabase";
import { C, Avatar, Btn, Input, timeStr } from "./ui";

export default function RoomView({ room, me, profiles, onToast, onLeave, onDeleted }) {
  const [parts, setParts] = useState([]);
  const [msgs, setMsgs] = useState([]);
  const [msg, setMsg] = useState("");
  const [micLive, setMicLive] = useState(false);
  const [speakingIds, setSpeakingIds] = useState([]);
  const [voiceStatus, setVoiceStatus] = useState("connecting"); // connecting | on | off
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const lkRoom = useRef(null);
  const audioBox = useRef(null);
  const endRef = useRef(null);
  const connecting = useRef(false);
  const toastRef = useRef(onToast);
  toastRef.current = onToast;

  const isAdmin = room.admin_id === me.id;
  const myPart = parts.find((p) => p.user_id === me.id);
  const myMicOn = myPart ? myPart.mic_on : false;
  const myHand = myPart ? myPart.hand : false;
  const myP = { mic_on: myMicOn, hand: myHand };
  const speakers = parts
    .filter((p) => p.mic_on)
    .sort((a, b) => (a.user_id === room.admin_id ? -1 : b.user_id === room.admin_id ? 1 : 0));
  const listeners = parts
    .filter((p) => !p.mic_on)
    .sort((a, b) => (b.hand ? 1 : 0) - (a.hand ? 1 : 0));
  const nameOf = (id) => (profiles[id] ? profiles[id].display_name : "...");

  /* ---- بارکردنی بەشدارەکان و نامەکان ---- */
  const loadParts = useCallback(async () => {
    const { data } = await supabase.from("room_participants").select("*").eq("room_id", room.id);
    if (data) setParts(data);
  }, [room.id]);

  const loadMsgs = useCallback(async () => {
    const { data } = await supabase
      .from("room_messages")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })
      .limit(150);
    if (data) setMsgs(data);
  }, [room.id]);

  /* ---- جۆین بوون + realtime ---- */
  useEffect(() => {
    (async () => {
      await supabase.from("room_participants").upsert(
        { room_id: room.id, user_id: me.id, mic_on: isAdmin, hand: false },
        { onConflict: "room_id,user_id" }
      );
      loadParts();
      loadMsgs();
    })();

    const ch = supabase
      .channel("room-" + room.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${room.id}` }, loadParts)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${room.id}` }, (p) =>
        setMsgs((m) => [...m, p.new])
      )
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "rooms" }, (p) => {
        if (p.old && p.old.id === room.id) {
          onToast("ڕوومەکە سڕایەوە");
          onDeleted();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [room.id]); // eslint-disable-line

  /* ---- پەیوەستبوون بە دەنگ (LiveKit) ---- */
  // iOS Safari: دەنگ پێویستی بە کردارێکی بەکارهێنەرە بۆ کردنەوە
  const unlockAudio = async () => {
    if (audioBox.current) {
      const audios = audioBox.current.querySelectorAll("audio");
      for (const a of audios) {
        try { await a.play(); } catch {}
      }
    }
    setAudioUnlocked(true);
  };

  const connectVoice = useCallback(async () => {
    if (connecting.current) return; // ڕێگری لە خولی دووبارە پەیوەستبوونەوە
    connecting.current = true;
    try {
      setVoiceStatus("connecting");
      if (lkRoom.current) {
        lkRoom.current.removeAllListeners();
        await lkRoom.current.disconnect();
        lkRoom.current = null;
      }
      const token = await getLiveKitToken(room.id);
      const r = new Room({
        adaptiveStream: true,
        dynacast: true,
        reconnectPolicy: { maxRetries: 5 },
      });
      r.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind === "audio" && audioBox.current) {
          const el = track.attach();
          el.autoplay = true;
          el.setAttribute("playsinline", "");
          audioBox.current.appendChild(el);
        }
      });
      r.on(RoomEvent.TrackUnsubscribed, (track) => track.detach().forEach((el) => el.remove()));
      r.on(RoomEvent.ActiveSpeakersChanged, (sp) => setSpeakingIds(sp.map((s) => s.identity)));
      r.on(RoomEvent.Reconnecting, () => setVoiceStatus("connecting"));
      r.on(RoomEvent.Reconnected, () => setVoiceStatus("on"));
      r.on(RoomEvent.Disconnected, () => {
        if (lkRoom.current === r) setVoiceStatus("off");
      });
      await r.connect(process.env.NEXT_PUBLIC_LIVEKIT_URL, token, { autoSubscribe: true });
      lkRoom.current = r;
      setVoiceStatus("on");
    } catch (e) {
      setVoiceStatus("off");
      toastRef.current("پەیوەستبوون بە دەنگ سەرکەوتوو نەبوو");
    } finally {
      connecting.current = false;
    }
  }, [room.id]);

  useEffect(() => {
    connectVoice();
    return () => {
      if (lkRoom.current) lkRoom.current.disconnect();
    };
  }, []); // eslint-disable-line

  /* کاتێک مۆڵەتی مایکم دەگۆڕێت → تۆکنی نوێ، بەبێ پچڕاندنی پەیوەندی */
  const prevMic = useRef(null);
  useEffect(() => {
    if (prevMic.current === null) {
      prevMic.current = myMicOn;
      return;
    }
    if (prevMic.current === myMicOn) return;
    prevMic.current = myMicOn;

    (async () => {
      setMicLive(false);
      if (myMicOn) {
        // مۆڵەتی مایک دراوە: پەیوەندی نوێ بە تۆکنی نوێ (canPublish=true)
        if (lkRoom.current) {
          lkRoom.current.removeAllListeners();
          await lkRoom.current.disconnect();
          lkRoom.current = null;
        }
        connecting.current = false;
        await connectVoice();
        toastRef.current("🎙️ ئەدمین مایکی کردیتەوە — دەتوانیت قسە بکەیت!");
      } else {
        // مۆڵەتی مایک لادەبرێت: مایک دابخە، پەیوەندی بمێنێت
        if (lkRoom.current) {
          try {
            await lkRoom.current.localParticipant.setMicrophoneEnabled(false);
          } catch {}
        }
      }
    })();
  }, [myMicOn, room.id, connectVoice]);

  const toggleMyMic = async () => {
    if (!lkRoom.current) return;
    try {
      const next = !micLive;
      await lkRoom.current.localParticipant.setMicrophoneEnabled(next);
      setMicLive(next);
    } catch {
      onToast("ڕێگە بە مایک نەدرا — لە وێبگەڕەکەت ڕێگە بدە");
    }
  };

  /* ---- کردارەکان ---- */
  const raiseHand = () =>
    supabase.from("room_participants").update({ hand: !myP.hand }).eq("room_id", room.id).eq("user_id", me.id);

  const toggleMicFor = (uid, cur) =>
    supabase.from("room_participants").update({ mic_on: !cur, hand: false }).eq("room_id", room.id).eq("user_id", uid);

  const send = async () => {
    if (!msg.trim()) return;
    const t = msg.trim();
    setMsg("");
    await supabase.from("room_messages").insert({ room_id: room.id, sender_id: me.id, text: t });
  };

  const leave = async () => {
    if (lkRoom.current) await lkRoom.current.disconnect();
    await supabase.from("room_participants").delete().eq("room_id", room.id).eq("user_id", me.id);
    onLeave();
  };

  const deleteRoom = async () => {
    if (lkRoom.current) await lkRoom.current.disconnect();
    await supabase.from("rooms").delete().eq("id", room.id);
    onLeave();
  };

  useEffect(() => {
    if (endRef.current) endRef.current.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length]);

  /* ================= ڕووکار ================= */
  return (
    <div style={{ position: "fixed", inset: 0, background: C.bg, zIndex: 20, display: "flex", flexDirection: "column", maxWidth: 560, margin: "0 auto" }} dir="rtl">
      <div ref={audioBox} style={{ display: "none" }} />

      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderBottom: `1px solid ${C.border}`, background: C.surface }}>
        <button onClick={leave} style={{ background: "none", border: "none", color: C.gold, fontSize: 20, cursor: "pointer" }}>→</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontFamily: "'Reem Kufi', sans-serif" }}>{room.name}</div>
          <div style={{ color: C.muted, fontSize: 12 }}>
            {parts.length} کەس ·{" "}
            <span style={{ color: voiceStatus === "on" ? C.green : voiceStatus === "connecting" ? C.gold : C.red }}>
              {voiceStatus === "on" ? "● دەنگ پەیوەستە" : voiceStatus === "connecting" ? "● پەیوەستبوون..." : "● دەنگ پچڕاوە"}
            </span>
            {voiceStatus === "on" && !audioUnlocked && (
              <button
                onClick={unlockAudio}
                style={{ marginInlineStart: 8, background: C.gold, color: "#1A1508", border: "none", borderRadius: 8, padding: "2px 8px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}
              >
                🔊 دەنگ چالاک بکە
              </button>
            )}
          </div>
        </div>
        {voiceStatus === "off" && <Btn small kind="ghost" onClick={connectVoice}>🔄</Btn>}
        {isAdmin && <Btn small kind="red" onClick={deleteRoom}>سڕینەوە</Btn>}
      </header>

      {/* 🎙️ ستەیج — قسەکەران */}
      <div style={{ borderBottom: `1px solid ${C.border}` }}>
        <div
          style={{
            padding: "16px 16px 18px",
            background: "linear-gradient(180deg, rgba(232,179,60,0.10) 0%, rgba(232,179,60,0.03) 70%, transparent 100%)",
            borderBottom: `1px dashed ${C.border}`,
          }}
        >
          <div style={{ fontSize: 12, color: C.gold, fontWeight: 700, marginBottom: 12 }}>
            🎙️ ستەیج — قسەکەران ({speakers.length})
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 18, justifyContent: speakers.length <= 3 ? "center" : "flex-start" }}>
            {speakers.length === 0 && (
              <div style={{ color: C.muted, fontSize: 13, width: "100%", textAlign: "center" }}>هێشتا کەس لەسەر ستەیج نییە</div>
            )}
            {speakers.map((p) => (
              <div key={p.user_id} style={{ textAlign: "center", width: 80 }}>
                <div style={{ position: "relative", display: "inline-block", animation: speakingIds.includes(p.user_id) ? "pulse 1s infinite" : "none" }}>
                  <Avatar name={nameOf(p.user_id)} size={64} ring="var(--gold)" />
                  {p.user_id === room.admin_id && <span style={{ position: "absolute", top: -8, insetInlineEnd: -4, fontSize: 16 }}>👑</span>}
                  <span style={{ position: "absolute", bottom: -5, insetInlineStart: "50%", transform: "translateX(50%)", fontSize: 11, background: C.gold, color: "#1A1508", borderRadius: 8, padding: "1px 6px", fontWeight: 700 }}>
                    🎙️
                  </span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, marginTop: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nameOf(p.user_id)}
                </div>
                {isAdmin && p.user_id !== me.id && (
                  <button
                    onClick={() => toggleMicFor(p.user_id, true)}
                    style={{ marginTop: 4, fontSize: 10, background: C.red, color: "#fff", border: "none", borderRadius: 8, padding: "3px 8px", cursor: "pointer", fontFamily: "inherit" }}
                  >
                    🔇 داخستنی مایک
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 👥 گوێگرەکان */}
        <div style={{ padding: "12px 16px 14px" }}>
          <div style={{ fontSize: 12, color: C.muted, fontWeight: 700, marginBottom: 10 }}>👥 گوێگرەکان ({listeners.length})</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {listeners.length === 0 && <div style={{ color: C.muted, fontSize: 12 }}>کەس لە گوێگرەکاندا نییە</div>}
            {listeners.map((p) => (
              <div key={p.user_id} style={{ textAlign: "center", width: 62 }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                  <Avatar name={nameOf(p.user_id)} size={44} dim />
                  {p.user_id === room.admin_id && <span style={{ position: "absolute", top: -6, insetInlineEnd: -4, fontSize: 13 }}>👑</span>}
                  {p.hand && <span style={{ position: "absolute", top: -6, insetInlineStart: -6, fontSize: 15, animation: "pulse 1.4s infinite" }}>✋</span>}
                </div>
                <div style={{ fontSize: 10.5, color: C.muted, marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {nameOf(p.user_id)}
                </div>
                {isAdmin && p.user_id !== me.id && (
                  <button
                    onClick={() => toggleMicFor(p.user_id, false)}
                    style={{ marginTop: 3, fontSize: 10, background: p.hand ? C.gold : C.green, color: p.hand ? "#1A1508" : "#fff", border: "none", borderRadius: 8, padding: "2px 7px", cursor: "pointer", fontFamily: "inherit", fontWeight: 700 }}
                  >
                    {p.hand ? "✋ ڕێگەپێدان" : "🎙️ کردنەوە"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* کۆنترۆڵی من */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "0 16px 12px" }}>
          {myP.mic_on ? (
            <Btn small kind={micLive ? "red" : "green"} onClick={toggleMyMic}>
              {micLive ? "🔴 داخستنی مایکەکەم" : "🎙️ کردنەوەی مایکەکەم"}
            </Btn>
          ) : (
            <Btn small kind={myP.hand ? "ghost" : "gold"} onClick={raiseHand}>
              {myP.hand ? "✋ دەستت بەرزە — چاوەڕوانی ئەدمین بە" : "✋ دەست بەرزکردنەوە بۆ قسەکردن"}
            </Btn>
          )}
        </div>
      </div>

      {/* چاتی ڕووم */}
      <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.length === 0 && <div style={{ color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 }}>یەکەم نامە بنووسە... 💬</div>}
        {msgs.map((m) => {
          const mine = m.sender_id === me.id;
          return (
            <div key={m.id} style={{ alignSelf: mine ? "flex-start" : "flex-end", maxWidth: "80%" }}>
              <div style={{ background: mine ? C.goldSoft : C.surface2, border: `1px solid ${mine ? "rgba(232,179,60,0.35)" : C.border}`, borderRadius: 14, padding: "8px 12px" }}>
                {!mine && <div style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>{nameOf(m.sender_id)}</div>}
                <div style={{ fontSize: 14 }}>{m.text}</div>
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{timeStr(m.created_at)}</div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div style={{ display: "flex", gap: 8, padding: 12, borderTop: `1px solid ${C.border}`, background: C.surface }}>
        <Input
          placeholder="نامەیەک بنووسە..."
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
        />
        <Btn small onClick={send}>ناردن</Btn>
      </div>
    </div>
  );
}