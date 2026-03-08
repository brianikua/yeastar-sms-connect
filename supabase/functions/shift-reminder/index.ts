import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const telegramBotToken = Deno.env.get("TELEGRAM_BOT_TOKEN");
    const telegramChatId = Deno.env.get("TELEGRAM_CHAT_ID");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    // Get current date/time in Nairobi timezone
    const now = new Date();
    const nairobiNow = new Date(now.toLocaleString("en-US", { timeZone: "Africa/Nairobi" }));
    const todayStr = nairobiNow.toISOString().split("T")[0]; // YYYY-MM-DD

    // Calculate the 30-minute window: shifts starting between 25-35 min from now
    const windowStart = new Date(nairobiNow.getTime() + 25 * 60 * 1000);
    const windowEnd = new Date(nairobiNow.getTime() + 35 * 60 * 1000);

    const startTimeStr = windowStart.toTimeString().slice(0, 5); // HH:MM
    const endTimeStr = windowEnd.toTimeString().slice(0, 5);

    console.log(`Checking shifts for ${todayStr} starting between ${startTimeStr} and ${endTimeStr}`);

    // Query scheduled shifts for today within the reminder window
    const { data: shifts, error: shiftsError } = await supabase
      .from("shift_schedule")
      .select("id, agent_id, start_time, end_time, notes")
      .eq("shift_date", todayStr)
      .gte("start_time", startTimeStr)
      .lte("start_time", endTimeStr);

    if (shiftsError) throw shiftsError;

    if (!shifts || shifts.length === 0) {
      console.log("No upcoming shifts in the reminder window");
      return new Response(JSON.stringify({ reminded: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get agent details for the shifts
    const agentIds = [...new Set(shifts.map((s: any) => s.agent_id))];
    const { data: agents, error: agentsError } = await supabase
      .from("agents")
      .select("id, name, email, phone")
      .in("id", agentIds);

    if (agentsError) throw agentsError;

    const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
    let remindedCount = 0;

    for (const shift of shifts) {
      const agent = agentMap.get(shift.agent_id);
      if (!agent) continue;

      const shiftStart = shift.start_time.slice(0, 5);
      const shiftEnd = shift.end_time.slice(0, 5);

      // Send Telegram reminder
      if (telegramBotToken && telegramChatId) {
        const message = `⏰ *Shift Reminder*\n\n*${agent.name}* — your shift starts in ~30 minutes\n🕐 ${shiftStart} – ${shiftEnd}\n📅 ${todayStr}${shift.notes ? `\n📝 ${shift.notes}` : ""}`;

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

      // Send email reminder
      if (resendApiKey && agent.email) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Nosteq Call Center <info@nosteq.co.ke>",
            to: [agent.email],
            subject: `⏰ Shift Reminder – Starting at ${shiftStart}`,
            html: `
              <h2>⏰ Shift Reminder</h2>
              <p>Hi <strong>${agent.name}</strong>,</p>
              <p>Your shift starts in approximately <strong>30 minutes</strong>.</p>
              <table style="border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:4px 12px;font-weight:bold;">Time</td><td style="padding:4px 12px;">${shiftStart} – ${shiftEnd}</td></tr>
                <tr><td style="padding:4px 12px;font-weight:bold;">Date</td><td style="padding:4px 12px;">${todayStr}</td></tr>
                ${shift.notes ? `<tr><td style="padding:4px 12px;font-weight:bold;">Notes</td><td style="padding:4px 12px;">${shift.notes}</td></tr>` : ""}
              </table>
              <p>Please clock in on time. Thank you!</p>
            `,
          }),
        });
      }

      remindedCount++;
      console.log(`Reminder sent to ${agent.name} for shift at ${shiftStart}`);
    }

    // Log the activity
    if (remindedCount > 0) {
      await supabase.from("activity_logs").insert({
        event_type: "shift_reminder",
        message: `Sent ${remindedCount} shift reminder(s) for shifts starting around ${startTimeStr}`,
        severity: "info",
      });
    }

    return new Response(JSON.stringify({ reminded: remindedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Shift reminder error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
