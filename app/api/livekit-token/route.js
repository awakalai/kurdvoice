import { NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

/*
  ئەم ئێندپۆینتە تۆکنی LiveKit دروست دەکات:
  - دڵنیا دەبێتەوە بەکارهێنەرەکە بە ڕاستی چووەتەژوورەوە (Supabase JWT)
  - بۆ ڕوومی ئاسایی: مۆڵەتی قسەکردن (canPublish) لە داتابەیسەوە وەردەگرێت (mic_on)
  - بۆ پەیوەندی تایبەت (call-...): هەردوو لایەن دەتوانن قسە بکەن
*/
export async function POST(req) {
  try {
    const { roomName } = await req.json();
    if (!roomName) return NextResponse.json({ error: "roomName پێویستە" }, { status: 400 });

    // پشکنینی بەکارهێنەر بە تۆکنی Supabase
    const authHeader = req.headers.get("authorization") || "";
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "چوونەژوورەوە پێویستە" }, { status: 401 });

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .single();

    let canPublish = false;

    if (roomName.startsWith("call-")) {
      // پەیوەندی تایبەت: تەنها ئەو دوو کەسە کە ناویان لە ناوی ڕوومەکەدایە
      const ids = roomName.replace("call-", "").split("_");
      if (!ids.includes(user.id)) {
        return NextResponse.json({ error: "ڕێگەپێنەدراو" }, { status: 403 });
      }
      canPublish = true;
    } else {
      // ڕوومی ئاسایی: مۆڵەتی مایک لە داتابەیسەوە
      const { data: part } = await supabase
        .from("room_participants")
        .select("mic_on")
        .eq("room_id", roomName)
        .eq("user_id", user.id)
        .single();
      canPublish = !!(part && part.mic_on);
    }

    const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
      identity: user.id,
      name: profile ? profile.display_name : "بەکارهێنەر",
      ttl: "2h",
    });
    at.addGrant({
      room: roomName,
      roomJoin: true,
      canSubscribe: true,
      canPublish,
      canPublishData: false,
    });

    return NextResponse.json({ token: await at.toJwt() });
  } catch (e) {
    return NextResponse.json({ error: "هەڵەیەک ڕوویدا" }, { status: 500 });
  }
}
