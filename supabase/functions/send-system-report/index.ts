import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeMarkdown(text: string): string {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, "\\$&");
}

async function sendTelegram(botToken: string, chatId: string, text: string) {
  const chunks: string[] = [];
  if (text.length <= 4000) {
    chunks.push(text);
  } else {
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= 4000) { chunks.push(remaining); break; }
      let splitIdx = remaining.lastIndexOf("\n", 4000);
      if (splitIdx <= 0) splitIdx = 4000;
      chunks.push(remaining.substring(0, splitIdx));
      remaining = remaining.substring(splitIdx);
    }
  }
  for (const chunk of chunks) {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: chunk, parse_mode: "MarkdownV2" }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Telegram API error [${res.status}]: ${body}`);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const {
      hours = 24,
      send_email = false,
      send_telegram = false,
      to_email,
    } = body;

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

    // Fetch all data for the time window in parallel
    const [smsRes, callsRes, missedCallsRes, logsRes, simRes, errorRes] = await Promise.all([
      supabase.from("sms_messages").select("*").gte("received_at", since).order("received_at", { ascending: false }),
      supabase.from("call_records").select("*").gte("start_time", since).order("start_time", { ascending: false }),
      supabase.from("call_records").select("*").gte("start_time", since).eq("status", "missed"),
      supabase.from("activity_logs").select("*").gte("created_at", since).order("created_at", { ascending: false }),
      supabase.from("sim_port_config").select("*").order("port_number"),
      supabase.from("error_logs").select("*").gte("created_at", since).eq("resolved", false),
    ]);

    const smsData = smsRes.data || [];
    const callsData = callsRes.data || [];
    const missedCalls = missedCallsRes.data || [];
    const logsData = logsRes.data || [];
    const simData = simRes.data || [];
    const errorData = errorRes.data || [];

    const activeSims = simData.filter((s: any) => s.enabled).length;
    const answeredCalls = callsData.filter((c: any) => c.status === "answered").length;
    const inboundCalls = callsData.filter((c: any) => c.direction === "inbound").length;
    const outboundCalls = callsData.filter((c: any) => c.direction === "outbound").length;
    const unreadSms = smsData.filter((s: any) => s.status === "unread").length;
    const errorLogs = logsData.filter((l: any) => l.severity === "error").length;

    const periodLabel = hours >= 24 ? `${hours / 24} day(s)` : `${hours} hour(s)`;
    const generatedAt = new Date().toLocaleString("en-GB", { timeZone: "UTC" });

    // ---- EMAIL ----
    if (send_email && to_email) {
      const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

      // Build category breakdown for SMS
      const categoryMap: Record<string, number> = {};
      for (const sms of smsData) {
        const cat = sms.category || "unknown";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      }
      const categoryRows = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .map(([cat, count]) => `<tr><td style="padding:6px 0;color:#666;text-transform:capitalize">${cat}</td><td style="padding:6px 0;color:#111;font-weight:600">${count}</td></tr>`)
        .join("");

      const missedCallRows = missedCalls.slice(0, 10)
        .map((c: any) => {
          const caller = c.caller_name ? `${c.caller_name} (${c.caller_number})` : c.caller_number;
          const time = new Date(c.start_time).toLocaleString("en-GB", { timeZone: "UTC" });
          const cb = c.callback_attempted ? `<span style="color:#16a34a">✓ Called back</span>` : `<span style="color:#dc2626">Pending</span>`;
          return `<tr style="border-bottom:1px solid #f0f0f0"><td style="padding:8px 4px;font-size:13px">${caller}</td><td style="padding:8px 4px;font-size:13px;color:#555">${time} UTC</td><td style="padding:8px 4px;font-size:13px">${cb}</td></tr>`;
        }).join("");

      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="background:#f4f4f4;font-family:Arial,sans-serif;margin:0;padding:20px">
  <div style="max-width:620px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
    <div style="background:#1a2332;padding:24px 32px">
      <h1 style="color:#2dd4bf;margin:0;font-size:20px;font-weight:700">📊 System Report — Last ${periodLabel}</h1>
      <p style="color:#94a3b8;margin:6px 0 0;font-size:13px">Generated: ${generatedAt} UTC</p>
    </div>
    <div style="padding:28px 32px">

      <!-- KPI Grid -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr>
          <td style="padding:12px;background:#f0fdf4;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a">${smsData.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Total SMS</p>
          </td>
          <td style="width:2%"></td>
          <td style="padding:12px;background:#eff6ff;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#2563eb">${callsData.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Total Calls</p>
          </td>
          <td style="width:2%"></td>
          <td style="padding:12px;background:#fef2f2;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626">${missedCalls.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Missed Calls</p>
          </td>
        </tr>
      </table>
      <table style="width:100%;border-collapse:collapse;margin-bottom:28px">
        <tr>
          <td style="padding:12px;background:#fefce8;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#ca8a04">${unreadSms}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Unread SMS</p>
          </td>
          <td style="width:2%"></td>
          <td style="padding:12px;background:#f0fdf4;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#16a34a">${activeSims}/${simData.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Active SIMs</p>
          </td>
          <td style="width:2%"></td>
          <td style="padding:12px;background:#fef2f2;border-radius:6px;text-align:center;width:33%">
            <p style="margin:0;font-size:24px;font-weight:700;color:#dc2626">${errorData.length}</p>
            <p style="margin:4px 0 0;font-size:11px;color:#555">Unresolved Errors</p>
          </td>
        </tr>
      </table>

      <!-- Calls breakdown -->
      <h2 style="font-size:14px;color:#374151;margin:0 0 10px">📞 Call Breakdown</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 0;color:#666">Answered</td><td style="padding:7px 0;font-weight:600">${answeredCalls}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 0;color:#666">Missed</td><td style="padding:7px 0;font-weight:600;color:#dc2626">${missedCalls.length}</td></tr>
        <tr style="border-bottom:1px solid #f0f0f0"><td style="padding:7px 0;color:#666">Inbound</td><td style="padding:7px 0;font-weight:600">${inboundCalls}</td></tr>
        <tr><td style="padding:7px 0;color:#666">Outbound</td><td style="padding:7px 0;font-weight:600">${outboundCalls}</td></tr>
      </table>

      ${categoryRows ? `
      <!-- SMS Categories -->
      <h2 style="font-size:14px;color:#374151;margin:0 0 10px">💬 SMS Categories</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">${categoryRows}</table>
      ` : ""}

      ${missedCallRows ? `
      <!-- Missed Calls -->
      <h2 style="font-size:14px;color:#374151;margin:0 0 10px">📵 Missed Calls (up to 10)</h2>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:24px">
        <tr style="background:#f9fafb"><th style="padding:8px 4px;text-align:left;font-size:12px;color:#666">Caller</th><th style="padding:8px 4px;text-align:left;font-size:12px;color:#666">Time</th><th style="padding:8px 4px;text-align:left;font-size:12px;color:#666">Status</th></tr>
        ${missedCallRows}
      </table>
      ` : ""}

    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">Sent by TG400 Dashboard · System Report · Period: Last ${periodLabel}</p>
    </div>
  </div>
</body></html>`;

      const { error: emailError } = await resend.emails.send({
        from: "TG400 Dashboard <info@nosteq.co.ke>",
        to: [to_email],
        subject: `📊 System Report — Last ${periodLabel} (${generatedAt} UTC)`,
        html,
      });

      if (emailError) throw new Error(`Email error: ${emailError.message}`);
    }

    // ---- TELEGRAM ----
    if (send_telegram) {
      const botToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
      const chatId = Deno.env.get("TELEGRAM_CHAT_ID");
      if (!botToken || !chatId) throw new Error("Telegram not configured");

      const e = escapeMarkdown;
      let msg = `📊 *SYSTEM REPORT — Last ${e(periodLabel)}*\n`;
      msg += `_Generated: ${e(generatedAt)} UTC_\n\n`;
      msg += `📱 *SMS:* ${smsData.length} total \\| ${unreadSms} unread\n`;
      msg += `📞 *Calls:* ${callsData.length} total \\| ${missedCalls.length} missed \\| ${answeredCalls} answered\n`;
      msg += `📡 *SIMs:* ${activeSims}/${simData.length} active\n`;
      msg += `🚨 *Errors:* ${errorData.length} unresolved \\| ${errorLogs} in logs\n\n`;

      msg += `📞 *Call Details:*\n`;
      msg += `  ⬇️ Inbound: ${inboundCalls} \\| ⬆️ Outbound: ${outboundCalls}\n`;
      msg += `  ✅ Answered: ${answeredCalls} \\| 📵 Missed: ${missedCalls.length}\n\n`;

      if (missedCalls.length > 0) {
        msg += `📵 *Pending Missed Calls:*\n`;
        for (const c of missedCalls.slice(0, 8)) {
          const caller = e(c.caller_name ? `${c.caller_name} \\(${c.caller_number}\\)` : c.caller_number);
          const time = e(new Date(c.start_time).toLocaleString("en-GB", { timeZone: "UTC" }));
          const cb = c.callback_attempted ? "✅" : "⏳";
          msg += `  ${cb} ${caller} — _${time}_\n`;
        }
        msg += "\n";
      }

      // SMS category breakdown
      const categoryMap: Record<string, number> = {};
      for (const sms of smsData) {
        const cat = sms.category || "unknown";
        categoryMap[cat] = (categoryMap[cat] || 0) + 1;
      }
      if (Object.keys(categoryMap).length > 0) {
        msg += `💬 *SMS Categories:*\n`;
        for (const [cat, cnt] of Object.entries(categoryMap).sort((a, b) => b[1] - a[1])) {
          msg += `  • ${e(cat)}: ${cnt}\n`;
        }
      }

      await sendTelegram(botToken, chatId, msg);
    }

    // Log the report send to activity_logs
    await supabase.from("activity_logs").insert({
      event_type: "report_sent",
      message: `System report sent for last ${periodLabel} via${send_email ? " email" : ""}${send_telegram ? " telegram" : ""}`,
      severity: "info",
    });

    return new Response(
      JSON.stringify({ success: true, period_hours: hours, sms_count: smsData.length, call_count: callsData.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-system-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
