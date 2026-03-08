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
    const { action, agent_name, agent_email, clock_time } = await req.json();

    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    const formattedTime = new Date(clock_time).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" });

    const emoji = action === "clock_in" ? "🟢" : "🔴";
    const verb = action === "clock_in" ? "clocked IN" : "clocked OUT";

    // Send Telegram notification
    if (telegramBotToken && telegramChatId) {
      const message = `${emoji} *Agent Shift Update*\n\n*${agent_name}* has ${verb}\n🕐 ${formattedTime}`;
      
      await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: telegramChatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });
    }

    // Send email notification
    if (resendApiKey && agent_email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: "Nosteq Call Center <info@nosteq.co.ke>",
          to: [agent_email],
          subject: `Shift ${action === "clock_in" ? "Started" : "Ended"} - ${agent_name}`,
          html: `
            <h2>${emoji} Shift ${action === "clock_in" ? "Started" : "Ended"}</h2>
            <p><strong>${agent_name}</strong> has ${verb} at <strong>${formattedTime}</strong></p>
          `,
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
