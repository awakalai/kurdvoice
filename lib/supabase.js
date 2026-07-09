"use client";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// یارمەتیدەر: تۆکنی LiveKit وەربگرە
export async function getLiveKitToken(roomName) {
  const { data: sess } = await supabase.auth.getSession();
  const res = await fetch("/api/livekit-token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sess.session?.access_token || ""}`,
    },
    body: JSON.stringify({ roomName }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error || "token error");
  return j.token;
}

export const pairRoom = (a, b) => "call-" + [a, b].sort().join("_");
