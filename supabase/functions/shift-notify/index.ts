import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sendTelegram = async (botToken: string, chatId: string, text: string) => {
  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let telegramMessage = "";
    let emailSubject = "";
    let emailHtml = "";
    let emailTo: string[] = [];
    let agentTelegramMessages: { chatId: string; text: string }[] = [];

    if (action === "reassign") {
      const { original_agent_name, original_agent_email, new_agent_name, new_agent_email, shift_date, start_time, end_time, reason } = body;

      telegramMessage = `🔄 *Shift Reassignment*\n\n📅 ${shift_date} · ${start_time}–${end_time}\n❌ *${original_agent_name}* → ✅ *${new_agent_name}*\n📝 Reason: _${reason}_`;
      emailSubject = `🔄 Shift Reassigned – ${shift_date} ${start_time}–${end_time}`;
      emailHtml = `<h2>🔄 Shift Reassignment</h2>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 12px;font-weight:bold;">Date</td><td style="padding:4px 12px;">${shift_date}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Time</td><td style="padding:4px 12px;">${start_time} – ${end_time}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Removed</td><td style="padding:4px 12px;">${original_agent_name}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Assigned To</td><td style="padding:4px 12px;">${new_agent_name}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Reason</td><td style="padding:4px 12px;">${reason}</td></tr>
        </table>`;
      if (original_agent_email) emailTo.push(original_agent_email);
      if (new_agent_email) emailTo.push(new_agent_email);

      // Notify agents personally
      if (body.new_agent_id) {
        const { data: newAgent } = await supabase.from("agents").select("telegram_chat_id").eq("id", body.new_agent_id).maybeSingle();
        if (newAgent?.telegram_chat_id) {
          agentTelegramMessages.push({ chatId: newAgent.telegram_chat_id, text: `📋 *You've been assigned a shift*\n📅 ${shift_date} · ${start_time}–${end_time}\n📝 ${reason}` });
        }
      }
      if (body.original_agent_id) {
        const { data: origAgent } = await supabase.from("agents").select("telegram_chat_id").eq("id", body.original_agent_id).maybeSingle();
        if (origAgent?.telegram_chat_id) {
          agentTelegramMessages.push({ chatId: origAgent.telegram_chat_id, text: `📋 *Your shift has been reassigned*\n📅 ${shift_date} · ${start_time}–${end_time}\n➡️ Assigned to ${new_agent_name}\n📝 ${reason}` });
        }
      }

    } else if (action === "swap_request") {
      const { requester_name, target_name, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;
      telegramMessage = `🔀 *Shift Swap Request*\n\n*${requester_name}* wants to swap with *${target_name}*\n\n📅 ${requester_name}: ${requester_shift_date} ${requester_shift_time}\n📅 ${target_name}: ${target_shift_date} ${target_shift_time}\n📝 Reason: _${reason}_\n\n⏳ Pending supervisor approval`;

    } else if (action === "swap_approved") {
      const { requester_name, requester_email, target_name, target_email, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;
      telegramMessage = `✅ *Shift Swap Approved*\n\n*${requester_name}* ↔ *${target_name}*\n\n📅 ${requester_name} now works: ${target_shift_date} ${target_shift_time}\n📅 ${target_name} now works: ${requester_shift_date} ${requester_shift_time}\n📝 Reason: _${reason}_`;
      emailSubject = `✅ Shift Swap Approved`;
      emailHtml = `<h2>✅ Shift Swap Approved</h2><p>Swap between <strong>${requester_name}</strong> and <strong>${target_name}</strong> has been approved.</p>`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

    } else if (action === "swap_rejected") {
      const { requester_name, requester_email, target_name, target_email, reason, review_note } = body;
      telegramMessage = `❌ *Shift Swap Rejected*\n\n*${requester_name}* ↔ *${target_name}*\n📝 Reason: _${reason}_${review_note ? `\n💬 Supervisor note: _${review_note}_` : ""}`;
      emailSubject = `❌ Shift Swap Rejected`;
      emailHtml = `<h2>❌ Shift Swap Rejected</h2><p>Swap between <strong>${requester_name}</strong> and <strong>${target_name}</strong> was rejected.</p>${review_note ? `<p>Note: ${review_note}</p>` : ""}`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

    } else if (action === "clock_in" || action === "clock_out") {
      const { agent_name, agent_email, agent_id, clock_time } = body;
      const formattedTime = new Date(clock_time).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
      const emoji = action === "clock_in" ? "🟢" : "🔴";
      const verb = action === "clock_in" ? "clocked IN" : "clocked OUT";

      telegramMessage = `${emoji} *Agent Shift Update*\n\n*${agent_name}* has ${verb}\n🕐 ${formattedTime}`;
      emailSubject = `Shift ${action === "clock_in" ? "Started" : "Ended"} - ${agent_name}`;
      emailHtml = `<h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2><p><strong>${agent_name}</strong> has ${verb} at <strong>${formattedTime}</strong></p>`;
      if (agent_email) emailTo.push(agent_email);

      // Send personal notification to agent
      if (agent_id) {
        const { data: agent } = await supabase.from("agents").select("telegram_chat_id, extension").eq("id", agent_id).maybeSingle();
        if (agent?.telegram_chat_id) {
          let personalMsg = `${emoji} You have ${verb} at ${formattedTime}`;

          // On clock out, include a daily summary
          if (action === "clock_out" && agent.extension) {
            const today = new Date().toISOString().split("T")[0];
            const { data: calls } = await supabase
              .from("call_records")
              .select("status, direction, talk_duration, callback_attempted")
              .eq("extension", agent.extension)
              .gte("start_time", `${today}T00:00:00`);

            const { data: smsData } = await supabase
              .from("sms_messages")
              .select("id, category")
              .gte("received_at", `${today}T00:00:00`);

            const totalCalls = (calls || []).length;
            const answered = (calls || []).filter((c: any) => c.status === "answered").length;
            const missed = (calls || []).filter((c: any) => c.status === "missed").length;
            const inbound = (calls || []).filter((c: any) => c.direction === "inbound").length;
            const outbound = (calls || []).filter((c: any) => c.direction === "outbound").length;
            const talkTime = (calls || []).reduce((s: number, c: any) => s + (c.talk_duration || 0), 0);
            const talkMin = Math.floor(talkTime / 60);
            const callbacks = (calls || []).filter((c: any) => c.callback_attempted).length;
            const totalSms = (smsData || []).length;

            personalMsg += `\n\n📊 *Your Daily Report*\n` +
              `📞 Calls: ${totalCalls} (${inbound}↙ ${outbound}↗)\n` +
              `✅ Answered: ${answered} | ❌ Missed: ${missed}\n` +
              `📲 Callbacks: ${callbacks}\n` +
              `⏱ Talk time: ${talkMin}m\n` +
              `💬 SMS received: ${totalSms}`;
          }
          agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: personalMsg });
        }
      }

    } else if (action === "agent_daily_report") {
      // Triggered manually or by cron — sends each agent their personal report
      const today = new Date().toISOString().split("T")[0];
      const { data: agents } = await supabase.from("agents").select("*").eq("is_active", true).not("telegram_chat_id", "is", null);

      for (const agent of agents || []) {
        if (!agent.telegram_chat_id || !agent.extension) continue;

        const { data: calls } = await supabase
          .from("call_records")
          .select("status, direction, talk_duration, callback_attempted")
          .eq("extension", agent.extension)
          .gte("start_time", `${today}T00:00:00`);

        const { data: shifts } = await supabase
          .from("agent_shifts")
          .select("clock_in, clock_out")
          .eq("agent_id", agent.id)
          .gte("clock_in", `${today}T00:00:00`);

        const totalCalls = (calls || []).length;
        const answered = (calls || []).filter((c: any) => c.status === "answered").length;
        const missed = (calls || []).filter((c: any) => c.status === "missed").length;
        const inbound = (calls || []).filter((c: any) => c.direction === "inbound").length;
        const outbound = (calls || []).filter((c: any) => c.direction === "outbound").length;
        const talkTime = (calls || []).reduce((s: number, c: any) => s + (c.talk_duration || 0), 0);
        const talkH = Math.floor(talkTime / 3600);
        const talkM = Math.floor((talkTime % 3600) / 60);

        let shiftTime = 0;
        (shifts || []).forEach((s: any) => {
          const start = new Date(s.clock_in);
          const end = s.clock_out ? new Date(s.clock_out) : new Date();
          shiftTime += (end.getTime() - start.getTime()) / 60000;
        });

        const msg = `📊 *Daily Report — ${agent.name}*\n📅 ${today}\n\n` +
          `⏰ Shift time: ${Math.floor(shiftTime / 60)}h ${Math.round(shiftTime % 60)}m\n` +
          `📞 Total calls: ${totalCalls} (${inbound}↙ ${outbound}↗)\n` +
          `✅ Answered: ${answered}\n❌ Missed: ${missed}\n` +
          `📲 Callbacks: ${(calls || []).filter((c: any) => c.callback_attempted).length}\n` +
          `⏱ Talk time: ${talkH}h ${talkM}m\n` +
          `${missed > 0 ? `\n⚠️ You have ${missed} missed call${missed > 1 ? "s" : ""} — please follow up!` : "✨ Great job — no missed calls!"}`;

        agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: msg });
      }
      telegramMessage = `📊 Daily agent reports sent to ${(agents || []).filter(a => a.telegram_chat_id && a.extension).length} agents`;
    }

    // Send to supervisor Telegram channel
    if (telegramBotToken && telegramChatId && telegramMessage) {
      await sendTelegram(telegramBotToken, telegramChatId, telegramMessage);
    }

    // Send personal Telegram to each agent
    if (telegramBotToken && agentTelegramMessages.length > 0) {
      await Promise.all(
        agentTelegramMessages.map((m) => sendTelegram(telegramBotToken, m.chatId, m.text))
      );
    }

    // Send email
    if (resendApiKey && emailTo.length > 0 && emailSubject) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
        body: JSON.stringify({
          from: "Nosteq Call Center <info@nosteq.co.ke>",
          to: emailTo,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true, agent_notifications: agentTelegramMessages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
