import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    let telegramMessage = "";
    let emailSubject = "";
    let emailHtml = "";
    let emailTo: string[] = [];

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

    } else if (action === "swap_request") {
      const { requester_name, target_name, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;

      telegramMessage = `🔀 *Shift Swap Request*\n\n*${requester_name}* wants to swap with *${target_name}*\n\n📅 ${requester_name}: ${requester_shift_date} ${requester_shift_time}\n📅 ${target_name}: ${target_shift_date} ${target_shift_time}\n📝 Reason: _${reason}_\n\n⏳ Pending supervisor approval`;
      // No email for request — just telegram alert to supervisor

    } else if (action === "swap_approved") {
      const { requester_name, requester_email, target_name, target_email, requester_shift_date, requester_shift_time, target_shift_date, target_shift_time, reason } = body;

      telegramMessage = `✅ *Shift Swap Approved*\n\n*${requester_name}* ↔ *${target_name}*\n\n📅 ${requester_name} now works: ${target_shift_date} ${target_shift_time}\n📅 ${target_name} now works: ${requester_shift_date} ${requester_shift_time}\n📝 Reason: _${reason}_`;
      emailSubject = `✅ Shift Swap Approved`;
      emailHtml = `<h2>✅ Shift Swap Approved</h2>
        <p>The shift swap between <strong>${requester_name}</strong> and <strong>${target_name}</strong> has been approved.</p>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 12px;font-weight:bold;">${requester_name}</td><td style="padding:4px 12px;">Now works ${target_shift_date} ${target_shift_time}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">${target_name}</td><td style="padding:4px 12px;">Now works ${requester_shift_date} ${requester_shift_time}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Reason</td><td style="padding:4px 12px;">${reason}</td></tr>
        </table>`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

    } else if (action === "swap_rejected") {
      const { requester_name, requester_email, target_name, target_email, reason, review_note } = body;

      telegramMessage = `❌ *Shift Swap Rejected*\n\n*${requester_name}* ↔ *${target_name}*\n📝 Reason: _${reason}_${review_note ? `\n💬 Supervisor note: _${review_note}_` : ""}`;
      emailSubject = `❌ Shift Swap Rejected`;
      emailHtml = `<h2>❌ Shift Swap Rejected</h2>
        <p>The shift swap request between <strong>${requester_name}</strong> and <strong>${target_name}</strong> has been rejected.</p>
        <p><strong>Original reason:</strong> ${reason}</p>
        ${review_note ? `<p><strong>Supervisor note:</strong> ${review_note}</p>` : ""}`;
      if (requester_email) emailTo.push(requester_email);
      if (target_email) emailTo.push(target_email);

    } else {
      // Original clock in/out logic
      const { agent_name, agent_email, clock_time } = body;
      const formattedTime = new Date(clock_time).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
      const emoji = action === "clock_in" ? "🟢" : "🔴";
      const verb = action === "clock_in" ? "clocked IN" : "clocked OUT";

      telegramMessage = `${emoji} *Agent Shift Update*\n\n*${agent_name}* has ${verb}\n🕐 ${formattedTime}`;
      emailSubject = `Shift ${action === "clock_in" ? "Started" : "Ended"} - ${agent_name}`;
      emailHtml = `<h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2>
        <p><strong>${agent_name}</strong> has ${verb} at <strong>${formattedTime}</strong></p>`;
      if (agent_email) emailTo.push(agent_email);
    }

    // Send Telegram notification
    if (telegramBotToken && telegramChatId && telegramMessage) {
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: telegramMessage,
          parse_mode: "Markdown",
        }),
      });
    }

    // Send email notification
    if (resendApiKey && emailTo.length > 0) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Nosteq Call Center <info@nosteq.co.ke>",
          to: emailTo,
          subject: emailSubject,
          html: emailHtml,
        }),
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
