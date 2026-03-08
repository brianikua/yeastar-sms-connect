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

const sendEmail = async (resendApiKey: string, to: string[], subject: string, html: string) => {
  if (!resendApiKey || to.length === 0) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendApiKey}` },
    body: JSON.stringify({
      from: "Nosteq Call Center <info@nosteq.co.ke>",
      to,
      subject,
      html,
    }),
  });
};

// Helper: try to notify an agent via Telegram; if no chat_id, queue email fallback
interface AgentNotification {
  agentId: string;
  telegramText: string;
  emailSubject: string;
  emailHtml: string;
}

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
    // Personal agent notifications (Telegram preferred, email fallback)
    let agentNotifications: AgentNotification[] = [];

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

      if (body.new_agent_id) {
        agentNotifications.push({
          agentId: body.new_agent_id,
          telegramText: `📋 *You've been assigned a shift*\n📅 ${shift_date} · ${start_time}–${end_time}\n📝 ${reason}`,
          emailSubject: `📋 You've been assigned a shift – ${shift_date}`,
          emailHtml: `<h2>📋 Shift Assignment</h2><p>You've been assigned a shift on <strong>${shift_date}</strong> from <strong>${start_time}</strong> to <strong>${end_time}</strong>.</p><p>Reason: ${reason}</p>`,
        });
      }
      if (body.original_agent_id) {
        agentNotifications.push({
          agentId: body.original_agent_id,
          telegramText: `📋 *Your shift has been reassigned*\n📅 ${shift_date} · ${start_time}–${end_time}\n➡️ Assigned to ${new_agent_name}\n📝 ${reason}`,
          emailSubject: `📋 Your shift has been reassigned – ${shift_date}`,
          emailHtml: `<h2>📋 Shift Reassigned</h2><p>Your shift on <strong>${shift_date}</strong> (${start_time}–${end_time}) has been reassigned to <strong>${new_agent_name}</strong>.</p><p>Reason: ${reason}</p>`,
        });
      }

    } else if (action === "swap_request") {
      const { requester_name, requester_agent_id, target_name, target_agent_id, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;
      telegramMessage = `🔀 *Shift Swap Request*\n\n*${requester_name}* wants to swap with *${target_name}*\n\n📅 ${requester_name}: ${requester_shift_date} ${requester_shift_time}\n📅 ${target_name}: ${target_shift_date} ${target_shift_time}\n📝 Reason: _${reason}_\n\n⏳ Pending supervisor approval`;

      if (target_agent_id) {
        agentNotifications.push({
          agentId: target_agent_id,
          telegramText: `🔀 *Swap Request*\n\n*${requester_name}* wants to swap shifts with you.\n\n📅 Your shift: ${target_shift_date} ${target_shift_time}\n📅 Their shift: ${requester_shift_date} ${requester_shift_time}\n📝 Reason: _${reason}_\n\n⏳ Awaiting supervisor approval`,
          emailSubject: `🔀 Shift Swap Request from ${requester_name}`,
          emailHtml: `<h2>🔀 Shift Swap Request</h2><p><strong>${requester_name}</strong> wants to swap shifts with you.</p><table style="border-collapse:collapse;margin:16px 0;"><tr><td style="padding:4px 12px;font-weight:bold;">Your shift</td><td style="padding:4px 12px;">${target_shift_date} ${target_shift_time}</td></tr><tr><td style="padding:4px 12px;font-weight:bold;">Their shift</td><td style="padding:4px 12px;">${requester_shift_date} ${requester_shift_time}</td></tr><tr><td style="padding:4px 12px;font-weight:bold;">Reason</td><td style="padding:4px 12px;">${reason}</td></tr></table><p>⏳ Awaiting supervisor approval.</p>`,
        });
      }
      if (requester_agent_id) {
        agentNotifications.push({
          agentId: requester_agent_id,
          telegramText: `📤 *Swap Request Submitted*\n\nYour request to swap with *${target_name}* has been submitted.\n\n📅 Your shift: ${requester_shift_date} ${requester_shift_time}\n📅 Their shift: ${target_shift_date} ${target_shift_time}\n\n⏳ Waiting for supervisor approval`,
          emailSubject: `📤 Swap Request Submitted`,
          emailHtml: `<h2>📤 Swap Request Submitted</h2><p>Your request to swap shifts with <strong>${target_name}</strong> has been submitted.</p><table style="border-collapse:collapse;margin:16px 0;"><tr><td style="padding:4px 12px;font-weight:bold;">Your shift</td><td style="padding:4px 12px;">${requester_shift_date} ${requester_shift_time}</td></tr><tr><td style="padding:4px 12px;font-weight:bold;">Their shift</td><td style="padding:4px 12px;">${target_shift_date} ${target_shift_time}</td></tr></table><p>⏳ Waiting for supervisor approval.</p>`,
        });
      }

    } else if (action === "swap_approved") {
      const { requester_name, requester_email, requester_agent_id, target_name, target_email, target_agent_id, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;
      telegramMessage = `✅ *Shift Swap Approved*\n\n*${requester_name}* ↔ *${target_name}*\n\n📅 ${requester_name} now works: ${target_shift_date} ${target_shift_time}\n📅 ${target_name} now works: ${requester_shift_date} ${requester_shift_time}\n📝 Reason: _${reason}_`;
      emailSubject = `✅ Shift Swap Approved`;
      emailHtml = `<h2>✅ Shift Swap Approved</h2><p>Swap between <strong>${requester_name}</strong> and <strong>${target_name}</strong> has been approved.</p>`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

      if (requester_agent_id) {
        agentNotifications.push({
          agentId: requester_agent_id,
          telegramText: `✅ *Swap Approved!*\n\nYour shift swap with *${target_name}* has been approved.\n\n📅 You now work: ${target_shift_date} ${target_shift_time}`,
          emailSubject: `✅ Shift Swap Approved`,
          emailHtml: `<h2>✅ Swap Approved!</h2><p>Your shift swap with <strong>${target_name}</strong> has been approved.</p><p>📅 You now work: <strong>${target_shift_date} ${target_shift_time}</strong></p>`,
        });
      }
      if (target_agent_id) {
        agentNotifications.push({
          agentId: target_agent_id,
          telegramText: `✅ *Swap Approved!*\n\nYour shift swap with *${requester_name}* has been approved.\n\n📅 You now work: ${requester_shift_date} ${requester_shift_time}`,
          emailSubject: `✅ Shift Swap Approved`,
          emailHtml: `<h2>✅ Swap Approved!</h2><p>Your shift swap with <strong>${requester_name}</strong> has been approved.</p><p>📅 You now work: <strong>${requester_shift_date} ${requester_shift_time}</strong></p>`,
        });
      }

    } else if (action === "swap_rejected") {
      const { requester_name, requester_email, requester_agent_id, target_name, target_email, target_agent_id, reason, review_note } = body;
      telegramMessage = `❌ *Shift Swap Rejected*\n\n*${requester_name}* ↔ *${target_name}*\n📝 Reason: _${reason}_${review_note ? `\n💬 Supervisor note: _${review_note}_` : ""}`;
      emailSubject = `❌ Shift Swap Rejected`;
      emailHtml = `<h2>❌ Shift Swap Rejected</h2><p>Swap between <strong>${requester_name}</strong> and <strong>${target_name}</strong> was rejected.</p>${review_note ? `<p>Note: ${review_note}</p>` : ""}`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

      if (requester_agent_id) {
        agentNotifications.push({
          agentId: requester_agent_id,
          telegramText: `❌ *Swap Rejected*\n\nYour shift swap with *${target_name}* was rejected.${review_note ? `\n💬 Note: _${review_note}_` : ""}`,
          emailSubject: `❌ Shift Swap Rejected`,
          emailHtml: `<h2>❌ Swap Rejected</h2><p>Your shift swap with <strong>${target_name}</strong> was rejected.</p>${review_note ? `<p>💬 Supervisor note: ${review_note}</p>` : ""}`,
        });
      }
      if (target_agent_id) {
        agentNotifications.push({
          agentId: target_agent_id,
          telegramText: `❌ *Swap Rejected*\n\nThe shift swap between you and *${requester_name}* was rejected.${review_note ? `\n💬 Note: _${review_note}_` : ""}`,
          emailSubject: `❌ Shift Swap Rejected`,
          emailHtml: `<h2>❌ Swap Rejected</h2><p>The shift swap between you and <strong>${requester_name}</strong> was rejected.</p>${review_note ? `<p>💬 Supervisor note: ${review_note}</p>` : ""}`,
        });
      }

    } else if (action === "clock_in" || action === "clock_out") {
      const { agent_name, agent_email, agent_id, clock_time } = body;
      const formattedTime = new Date(clock_time).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
      const emoji = action === "clock_in" ? "🟢" : "🔴";
      const verb = action === "clock_in" ? "clocked IN" : "clocked OUT";

      telegramMessage = `${emoji} *Agent Shift Update*\n\n*${agent_name}* has ${verb}\n🕐 ${formattedTime}`;
      emailSubject = `Shift ${action === "clock_in" ? "Started" : "Ended"} - ${agent_name}`;
      emailHtml = `<h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2><p><strong>${agent_name}</strong> has ${verb} at <strong>${formattedTime}</strong></p>`;
      if (agent_email) emailTo.push(agent_email);

      if (agent_id) {
        let personalTelegramMsg = `${emoji} You have ${verb} at ${formattedTime}`;
        let personalEmailHtml = `<h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2><p>You have ${verb} at <strong>${formattedTime}</strong>.</p>`;

        // On clock out, include a daily summary
        if (action === "clock_out") {
          const { data: agent } = await supabase.from("agents").select("telegram_chat_id, email, extension, notification_channel").eq("id", agent_id).maybeSingle();
          if (agent?.extension) {
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

            const reportSuffix = `\n\n📊 *Your Daily Report*\n` +
              `📞 Calls: ${totalCalls} (${inbound}↙ ${outbound}↗)\n` +
              `✅ Answered: ${answered} | ❌ Missed: ${missed}\n` +
              `📲 Callbacks: ${callbacks}\n` +
              `⏱ Talk time: ${talkMin}m\n` +
              `💬 SMS received: ${totalSms}`;
            personalTelegramMsg += reportSuffix;
            personalEmailHtml += `<h3>📊 Your Daily Report</h3><table style="border-collapse:collapse;margin:8px 0;"><tr><td style="padding:2px 8px;">📞 Calls</td><td style="padding:2px 8px;">${totalCalls} (${inbound}↙ ${outbound}↗)</td></tr><tr><td style="padding:2px 8px;">✅ Answered</td><td style="padding:2px 8px;">${answered}</td></tr><tr><td style="padding:2px 8px;">❌ Missed</td><td style="padding:2px 8px;">${missed}</td></tr><tr><td style="padding:2px 8px;">📲 Callbacks</td><td style="padding:2px 8px;">${callbacks}</td></tr><tr><td style="padding:2px 8px;">⏱ Talk time</td><td style="padding:2px 8px;">${talkMin}m</td></tr><tr><td style="padding:2px 8px;">💬 SMS</td><td style="padding:2px 8px;">${totalSms}</td></tr></table>`;
          }

          // For clock_out, we already fetched the agent — send based on preference
          const clockPref = agent?.notification_channel || "telegram";
          const clockCanTg = agent?.telegram_chat_id && telegramBotToken;
          const clockCanEmail = agent?.email && resendApiKey;

          if (clockPref === "both") {
            if (clockCanTg) agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: personalTelegramMsg });
            if (clockCanEmail) await sendEmail(resendApiKey!, [agent.email], `${emoji} Shift Ended – Daily Report`, personalEmailHtml);
          } else if (clockPref === "telegram") {
            if (clockCanTg) {
              agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: personalTelegramMsg });
            } else if (clockCanEmail) {
              await sendEmail(resendApiKey!, [agent.email], `${emoji} Shift Ended – Daily Report`, personalEmailHtml);
            }
          } else if (clockPref === "email") {
            if (clockCanEmail) {
              await sendEmail(resendApiKey!, [agent.email], `${emoji} Shift Ended – Daily Report`, personalEmailHtml);
            } else if (clockCanTg) {
              agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: personalTelegramMsg });
            }
          }
        } else {
          // clock_in — use the unified notification system
          agentNotifications.push({
            agentId: agent_id,
            telegramText: personalTelegramMsg,
            emailSubject: `${emoji} Shift Started`,
            emailHtml: personalEmailHtml,
          });
        }
      }

    } else if (action === "agent_daily_report") {
      const today = new Date().toISOString().split("T")[0];
      const { data: agents } = await supabase.from("agents").select("*").eq("is_active", true);

      for (const agent of agents || []) {
        if (!agent.extension) continue;

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

        const telegramMsg = `📊 *Daily Report — ${agent.name}*\n📅 ${today}\n\n` +
          `⏰ Shift time: ${Math.floor(shiftTime / 60)}h ${Math.round(shiftTime % 60)}m\n` +
          `📞 Total calls: ${totalCalls} (${inbound}↙ ${outbound}↗)\n` +
          `✅ Answered: ${answered}\n❌ Missed: ${missed}\n` +
          `📲 Callbacks: ${(calls || []).filter((c: any) => c.callback_attempted).length}\n` +
          `⏱ Talk time: ${talkH}h ${talkM}m\n` +
          `${missed > 0 ? `\n⚠️ You have ${missed} missed call${missed > 1 ? "s" : ""} — please follow up!` : "✨ Great job — no missed calls!"}`;

        const emailBody = `<h2>📊 Daily Report — ${agent.name}</h2><p>📅 ${today}</p><table style="border-collapse:collapse;margin:8px 0;"><tr><td style="padding:2px 8px;">⏰ Shift time</td><td style="padding:2px 8px;">${Math.floor(shiftTime / 60)}h ${Math.round(shiftTime % 60)}m</td></tr><tr><td style="padding:2px 8px;">📞 Calls</td><td style="padding:2px 8px;">${totalCalls} (${inbound}↙ ${outbound}↗)</td></tr><tr><td style="padding:2px 8px;">✅ Answered</td><td style="padding:2px 8px;">${answered}</td></tr><tr><td style="padding:2px 8px;">❌ Missed</td><td style="padding:2px 8px;">${missed}</td></tr><tr><td style="padding:2px 8px;">⏱ Talk time</td><td style="padding:2px 8px;">${talkH}h ${talkM}m</td></tr></table>${missed > 0 ? `<p>⚠️ You have ${missed} missed call${missed > 1 ? "s" : ""} — please follow up!</p>` : "<p>✨ Great job — no missed calls!</p>"}`;

        const pref = agent.notification_channel || "telegram";
        const canTelegram = agent.telegram_chat_id && telegramBotToken;
        const canEmail = agent.email && resendApiKey;

        if (pref === "both") {
          if (canTelegram) agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: telegramMsg });
          if (canEmail) await sendEmail(resendApiKey!, [agent.email], `📊 Daily Report — ${agent.name}`, emailBody);
        } else if (pref === "telegram") {
          if (canTelegram) {
            agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: telegramMsg });
          } else if (canEmail) {
            await sendEmail(resendApiKey!, [agent.email], `📊 Daily Report — ${agent.name}`, emailBody);
          }
        } else if (pref === "email") {
          if (canEmail) {
            await sendEmail(resendApiKey!, [agent.email], `📊 Daily Report — ${agent.name}`, emailBody);
          } else if (canTelegram) {
            agentTelegramMessages.push({ chatId: agent.telegram_chat_id, text: telegramMsg });
          }
        }
      }
      telegramMessage = `📊 Daily agent reports sent to ${(agents || []).length} agents`;
    }

    // Send to supervisor Telegram channel
    if (telegramBotToken && telegramChatId && telegramMessage) {
      await sendTelegram(telegramBotToken, telegramChatId, telegramMessage);
    }

    // Send personal Telegram to each agent (legacy direct pushes)
    if (telegramBotToken && agentTelegramMessages.length > 0) {
      await Promise.all(
        agentTelegramMessages.map((m) => sendTelegram(telegramBotToken, m.chatId, m.text))
      );
    }

    // Process unified agent notifications: respect notification_channel preference
    let emailFallbackCount = 0;
    let telegramSentCount = 0;
    if (agentNotifications.length > 0) {
      const agentIds = [...new Set(agentNotifications.map((n) => n.agentId))];
      const { data: agentsData } = await supabase
        .from("agents")
        .select("id, telegram_chat_id, email, notification_channel")
        .in("id", agentIds);

      const agentMap = new Map((agentsData || []).map((a: any) => [a.id, a]));

      for (const notification of agentNotifications) {
        const agent = agentMap.get(notification.agentId);
        if (!agent) continue;

        const pref = agent.notification_channel || "telegram";
        const canTelegram = agent.telegram_chat_id && telegramBotToken;
        const canEmail = agent.email && resendApiKey;

        if (pref === "both") {
          if (canTelegram) {
            await sendTelegram(telegramBotToken!, agent.telegram_chat_id, notification.telegramText);
            telegramSentCount++;
          }
          if (canEmail) {
            await sendEmail(resendApiKey!, [agent.email], notification.emailSubject, notification.emailHtml);
            emailFallbackCount++;
          }
        } else if (pref === "telegram") {
          if (canTelegram) {
            await sendTelegram(telegramBotToken!, agent.telegram_chat_id, notification.telegramText);
            telegramSentCount++;
          } else if (canEmail) {
            // Fallback to email if Telegram not configured
            await sendEmail(resendApiKey!, [agent.email], notification.emailSubject, notification.emailHtml);
            emailFallbackCount++;
          }
        } else if (pref === "email") {
          if (canEmail) {
            await sendEmail(resendApiKey!, [agent.email], notification.emailSubject, notification.emailHtml);
            emailFallbackCount++;
          } else if (canTelegram) {
            // Fallback to Telegram if email not configured
            await sendTelegram(telegramBotToken!, agent.telegram_chat_id, notification.telegramText);
            telegramSentCount++;
          }
        }
      }
    }

    // Send supervisor/broadcast email (non-agent-specific)
    if (resendApiKey && emailTo.length > 0 && emailSubject) {
      await sendEmail(resendApiKey, emailTo, emailSubject, emailHtml);
    }

    return new Response(JSON.stringify({
      success: true,
      agent_telegram: agentTelegramMessages.length,
      agent_notifications: agentNotifications.length,
      email_fallbacks: emailFallbackCount,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
