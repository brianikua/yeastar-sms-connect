import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TelegramMessage {
  chat_id: string;
  text: string;
  parse_mode?: string;
}

async function sendTelegram(botToken: string, msg: TelegramMessage) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(msg),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error [${res.status}]: ${body}`);
  }
  return res.json();
}

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const TELEGRAM_CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

    if (!TELEGRAM_BOT_TOKEN) {
      throw new Error("TELEGRAM_BOT_TOKEN is not configured");
    }
    if (!TELEGRAM_CHAT_ID) {
      throw new Error("TELEGRAM_CHAT_ID is not configured");
    }

    // Auth check - allow service role key for cron jobs, or user JWT for manual calls
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const isServiceRole = token === serviceRoleKey;

    let supabase;
    if (isServiceRole) {
      // Cron job call - use service role for full access
      console.log("Cron/service call detected, using service role");
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
    } else {
      // User call - validate JWT
      supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body = await req.json();
    const { action } = body;
    console.log(`Telegram notify action: ${action}`);

    let messageText = "";

    if (action === "system_summary") {
      // Fetch all data for a full summary
      const [smsRes, callsRes, logsRes, simRes, gwRes, pbxRes] = await Promise.all([
        supabase.from("sms_messages").select("*").order("received_at", { ascending: false }).limit(10),
        supabase.from("call_records").select("*").order("start_time", { ascending: false }).limit(10),
        supabase.from("activity_logs").select("*").order("created_at", { ascending: false }).limit(10),
        supabase.from("sim_port_config").select("*").order("port_number"),
        supabase.from("gateway_config").select("*").limit(1),
        supabase.from("pbx_config").select("*").limit(1),
      ]);

      const activeSims = (simRes.data || []).filter((s: any) => s.enabled).length;
      const totalSims = (simRes.data || []).length;
      const gwIp = gwRes.data?.[0]?.gateway_ip || "N/A";
      const pbxIp = pbxRes.data?.[0]?.pbx_ip || "N/A";

      messageText = `📊 *SYSTEM SUMMARY*\n\n`;
      messageText += `🔧 *Gateway:* ${escapeMarkdown(gwIp)}\n`;
      messageText += `📞 *PBX:* ${escapeMarkdown(pbxIp)}\n`;
      messageText += `📡 *SIMs:* ${activeSims}/${totalSims} active\n\n`;

      // Recent SMS
      messageText += `💬 *Recent SMS \\(${(smsRes.data || []).length}\\):*\n`;
      for (const sms of (smsRes.data || []).slice(0, 5)) {
        const from = escapeMarkdown(sms.sender_number || "Unknown");
        const msg = escapeMarkdown((sms.message_content || "").substring(0, 50));
        const cat = escapeMarkdown(sms.category || "unknown");
        messageText += `  • SIM${sms.sim_port} ← ${from}: ${msg} \\[${cat}\\]\n`;
      }

      // Recent Calls
      messageText += `\n📞 *Recent Calls \\(${(callsRes.data || []).length}\\):*\n`;
      for (const call of (callsRes.data || []).slice(0, 5)) {
        const dir = call.direction === "inbound" ? "⬇️" : call.direction === "outbound" ? "⬆️" : "↔️";
        const caller = escapeMarkdown(call.caller_number || "Unknown");
        const callee = escapeMarkdown(call.callee_number || "Unknown");
        const status = escapeMarkdown(call.status || "unknown");
        const dur = call.total_duration ? `${call.total_duration}s` : "N/A";
        messageText += `  ${dir} ${caller} → ${callee} \\[${status}, ${escapeMarkdown(dur)}\\]\n`;
      }

      // Recent Logs
      messageText += `\n📋 *Recent Logs \\(${(logsRes.data || []).length}\\):*\n`;
      for (const log of (logsRes.data || []).slice(0, 5)) {
        const sev = log.severity === "error" ? "🔴" : log.severity === "warning" ? "🟡" : log.severity === "success" ? "🟢" : "🔵";
        const msg = escapeMarkdown((log.message || "").substring(0, 60));
        messageText += `  ${sev} ${msg}\n`;
      }

    } else if (action === "sms_logs") {
      const { data: smsData } = await supabase
        .from("sms_messages")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(20);

      messageText = `💬 *SMS LOG REPORT*\n\n`;
      messageText += `Total fetched: ${(smsData || []).length}\n\n`;
      for (const sms of smsData || []) {
        const from = escapeMarkdown(sms.sender_number);
        const msg = escapeMarkdown((sms.message_content || "").substring(0, 80));
        const cat = escapeMarkdown(sms.category || "unknown");
        const time = escapeMarkdown(new Date(sms.received_at).toLocaleString());
        messageText += `📱 SIM${sms.sim_port} ← *${from}*\n  ${msg}\n  _${cat} \\| ${time}_\n\n`;
      }
      if (!(smsData || []).length) messageText += `_No SMS messages found_`;

    } else if (action === "call_logs") {
      const { data: callData } = await supabase
        .from("call_records")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(20);

      messageText = `📞 *CALL LOG REPORT*\n\n`;
      messageText += `Total fetched: ${(callData || []).length}\n\n`;
      for (const call of callData || []) {
        const dir = call.direction === "inbound" ? "⬇️ IN" : call.direction === "outbound" ? "⬆️ OUT" : "↔️ INT";
        const caller = escapeMarkdown(call.caller_number);
        const callee = escapeMarkdown(call.callee_number);
        const status = escapeMarkdown(call.status);
        const dur = call.total_duration ? `${call.total_duration}s` : "N/A";
        const time = escapeMarkdown(new Date(call.start_time).toLocaleString());
        messageText += `${dir} *${caller}* → *${callee}*\n  Status: ${status} \\| Duration: ${escapeMarkdown(dur)}\n  _${time}_\n\n`;
      }
      if (!(callData || []).length) messageText += `_No call records found_`;

    } else if (action === "activity_logs") {
      const { data: logData } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      messageText = `📋 *ACTIVITY LOG REPORT*\n\n`;
      messageText += `Total fetched: ${(logData || []).length}\n\n`;
      for (const log of logData || []) {
        const sev = log.severity === "error" ? "🔴" : log.severity === "warning" ? "🟡" : log.severity === "success" ? "🟢" : "🔵";
        const msg = escapeMarkdown(log.message);
        const type = escapeMarkdown(log.event_type);
        const time = escapeMarkdown(new Date(log.created_at).toLocaleString());
        messageText += `${sev} *${type}*\n  ${msg}\n  _${time}_\n\n`;
      }
      if (!(logData || []).length) messageText += `_No activity logs found_`;

    } else if (action === "gateway_status") {
      const [gwRes, pbxRes, simRes] = await Promise.all([
        supabase.from("gateway_config").select("*").limit(1),
        supabase.from("pbx_config").select("*").limit(1),
        supabase.from("sim_port_config").select("*").order("port_number"),
      ]);

      const gw = gwRes.data?.[0];
      const pbx = pbxRes.data?.[0];
      const sims = simRes.data || [];

      messageText = `🔧 *GATEWAY & PBX STATUS*\n\n`;
      messageText += `*Gateway:*\n`;
      messageText += `  IP: ${escapeMarkdown(gw?.gateway_ip || "Not configured")}\n`;
      messageText += `  User: ${escapeMarkdown(gw?.api_username || "N/A")}\n\n`;
      messageText += `*PBX:*\n`;
      messageText += `  IP: ${escapeMarkdown(pbx?.pbx_ip || "Not configured")}\n`;
      messageText += `  Port: ${pbx?.pbx_port || "N/A"}\n`;
      messageText += `  Web Port: ${pbx?.web_port || "N/A"}\n\n`;

      messageText += `*SIM Ports:*\n`;
      for (const sim of sims) {
        const status = sim.enabled ? "✅" : "❌";
        const num = escapeMarkdown(sim.phone_number || "No number");
        const carrier = escapeMarkdown(sim.carrier || "Unknown");
        const signal = sim.signal_strength != null ? `${sim.signal_strength}%` : "N/A";
        messageText += `  ${status} Port ${sim.port_number}: ${num} \\(${carrier}\\) Signal: ${escapeMarkdown(signal)}\n`;
      }

    } else if (action === "error_logs") {
      const { data: errorData } = await supabase
        .from("error_logs")
        .select("*")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(20);

      messageText = `🚨 *UNRESOLVED ERROR REPORT*\n\n`;
      messageText += `Count: ${(errorData || []).length}\n\n`;
      for (const err of errorData || []) {
        const type = escapeMarkdown(err.error_type);
        const msg = escapeMarkdown((err.error_message || "").substring(0, 100));
        const time = escapeMarkdown(new Date(err.created_at).toLocaleString());
        const diagnosis = err.ai_diagnosis ? `\n  💡 ${escapeMarkdown(err.ai_diagnosis.substring(0, 80))}` : "";
        messageText += `🔴 *${type}*\n  ${msg}${diagnosis}\n  _${time}_\n\n`;
      }
      if (!(errorData || []).length) messageText += `✅ _No unresolved errors_`;

    } else if (action === "rating_notification") {
      const { agent_id, rating, comment: ratingComment } = body;

      // Look up agent to get their telegram_chat_id
      const { data: agent } = await supabase
        .from("agents")
        .select("name, telegram_chat_id")
        .eq("id", agent_id)
        .single();

      if (!agent) throw new Error("Agent not found");

      const stars = "⭐".repeat(rating);
      const label = ["", "Poor", "Below Average", "Average", "Good", "Excellent"][rating] || "";
      const name = escapeMarkdown(agent.name);
      const commentLine = ratingComment
        ? `\n💬 _${escapeMarkdown(ratingComment)}_`
        : "";

      messageText = `🏅 *NEW SHIFT RATING*\n\n`;
      messageText += `👤 *Agent:* ${name}\n`;
      messageText += `${stars} *${escapeMarkdown(label)}* \\(${rating}/5\\)${commentLine}`;

      // Send to agent's personal Telegram if configured
      if (agent.telegram_chat_id) {
        const personalMsg = `🏅 *Your Shift Rating*\n\n`
          + `${stars} *${escapeMarkdown(label)}* \\(${rating}/5\\)${commentLine}\n\n`
          + `_Keep up the great work\\!_`;

        await sendTelegram(TELEGRAM_BOT_TOKEN, {
          chat_id: agent.telegram_chat_id,
          text: personalMsg,
          parse_mode: "MarkdownV2",
        });
      }

    } else if (action === "weekly_rating_digest") {
      // Get ratings from the past 7 days
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

      const [ratingsRes, agentsRes] = await Promise.all([
        supabase.from("agent_ratings").select("*").gte("rating_date", weekAgo),
        supabase.from("agents").select("id, name, telegram_chat_id").eq("is_active", true),
      ]);

      const ratings = ratingsRes.data || [];
      const agents = agentsRes.data || [];
      const agentMap = new Map(agents.map((a: any) => [a.id, a]));

      // Aggregate per agent
      const agentStats = new Map<string, { total: number; count: number; best: number; worst: number }>();
      for (const r of ratings) {
        const s = agentStats.get(r.agent_id) || { total: 0, count: 0, best: 0, worst: 6 };
        s.total += r.rating;
        s.count += 1;
        s.best = Math.max(s.best, r.rating);
        s.worst = Math.min(s.worst, r.rating);
        agentStats.set(r.agent_id, s);
      }

      // Sort by average descending
      const ranked = [...agentStats.entries()]
        .map(([id, s]) => ({ id, avg: s.total / s.count, count: s.count, best: s.best, worst: s.worst }))
        .sort((a, b) => b.avg - a.avg);

      messageText = `📊 *WEEKLY PERFORMANCE DIGEST*\n\n`;
      messageText += `_Ratings from ${escapeMarkdown(weekAgo)} to today_\n`;
      messageText += `📝 Total ratings: ${ratings.length} across ${agentStats.size} agents\n\n`;

      if (ranked.length === 0) {
        messageText += `_No ratings submitted this week_`;
      } else {
        // Leaderboard
        const medals = ["🥇", "🥈", "🥉"];
        for (let i = 0; i < ranked.length; i++) {
          const r = ranked[i];
          const agent = agentMap.get(r.id);
          const name = escapeMarkdown(agent?.name || "Unknown");
          const medal = i < 3 ? medals[i] : `${i + 1}\\.`;
          const avgStr = r.avg.toFixed(1);
          const stars = "⭐".repeat(Math.round(r.avg));
          messageText += `${medal} *${name}* — ${stars} ${escapeMarkdown(avgStr)}/5\n`;
          messageText += `   ${r.count} ratings \\| Best: ${r.best} \\| Lowest: ${r.worst}\n\n`;
        }

        // Team average
        const teamAvg = ratings.reduce((s: number, r: any) => s + r.rating, 0) / ratings.length;
        messageText += `\n📈 *Team Average:* ${escapeMarkdown(teamAvg.toFixed(1))}/5`;
      }

      // Also send personal summaries to agents with Telegram configured
      for (const [agentId, stats] of agentStats.entries()) {
        const agent = agentMap.get(agentId);
        if (!agent?.telegram_chat_id) continue;

        const avg = stats.total / stats.count;
        const personalMsg = `📊 *Your Weekly Rating Summary*\n\n`
          + `${"⭐".repeat(Math.round(avg))} *${escapeMarkdown(avg.toFixed(1))}*/5 average\n`
          + `📝 ${stats.count} rating\\(s\\) this week\n`
          + `🏆 Best: ${stats.best}/5 \\| Lowest: ${stats.worst}/5\n\n`
          + `_Keep pushing for excellence\\!_`;

        await sendTelegram(TELEGRAM_BOT_TOKEN, {
          chat_id: agent.telegram_chat_id,
          text: personalMsg,
          parse_mode: "MarkdownV2",
        });
      }

    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    // Split long messages (Telegram limit is 4096 chars)
    const chunks: string[] = [];
    if (messageText.length <= 4096) {
      chunks.push(messageText);
    } else {
      let remaining = messageText;
      while (remaining.length > 0) {
        if (remaining.length <= 4096) {
          chunks.push(remaining);
          break;
        }
        let splitIdx = remaining.lastIndexOf("\n", 4096);
        if (splitIdx <= 0) splitIdx = 4096;
        chunks.push(remaining.substring(0, splitIdx));
        remaining = remaining.substring(splitIdx);
      }
    }

    for (const chunk of chunks) {
      await sendTelegram(TELEGRAM_BOT_TOKEN, {
        chat_id: TELEGRAM_CHAT_ID,
        text: chunk,
        parse_mode: "MarkdownV2",
      });
    }

    console.log(`Telegram message sent successfully for action: ${action}`);
    return new Response(
      JSON.stringify({ success: true, action, chunks: chunks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Telegram notify error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
