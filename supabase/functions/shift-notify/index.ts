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
      const {
        original_agent_name,
        original_agent_email,
        new_agent_name,
        new_agent_email,
        shift_date,
        start_time,
        end_time,
        reason,
      } = body;

      telegramMessage = [
        `🔄 *Shift Reassignment*`,
        ``,
        `📅 ${shift_date} · ${start_time}–${end_time}`,
        `❌ *${original_agent_name}* → ✅ *${new_agent_name}*`,
        `📝 Reason: _${reason}_`,
      ].join("\n");

      emailSubject = `🔄 Shift Reassigned – ${shift_date} ${start_time}–${end_time}`;
      emailHtml = `
        <h2>🔄 Shift Reassignment</h2>
        <table style="border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:4px 12px;font-weight:bold;">Date</td><td style="padding:4px 12px;">${shift_date}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Time</td><td style="padding:4px 12px;">${start_time} – ${end_time}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Removed</td><td style="padding:4px 12px;">${original_agent_name}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Assigned To</td><td style="padding:4px 12px;">${new_agent_name}</td></tr>
          <tr><td style="padding:4px 12px;font-weight:bold;">Reason</td><td style="padding:4px 12px;">${reason}</td></tr>
        </table>
      `;

      // Notify both agents
      if (original_agent_email) emailTo.push(original_agent_email);
      if (new_agent_email) emailTo.push(new_agent_email);
    } else {
      // Original clock in/out logic
      const { agent_name, agent_email, clock_time } = body;
      const formattedTime = new Date(clock_time).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });
      const emoji = action === "clock_in" ? "🟢" : "🔴";
      const verb = action === "clock_in" ? "clocked IN" : "clocked OUT";

      telegramMessage = `${emoji} *Agent Shift Update*\n\n*${agent_name}* has ${verb}\n🕐 ${formattedTime}`;
      emailSubject = `Shift ${action === "clock_in" ? "Started" : "Ended"} - ${agent_name}`;
      emailHtml = `
        <h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2>
        <p><strong>${agent_name}</strong> has ${verb} at <strong>${formattedTime}</strong></p>
      `;
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
