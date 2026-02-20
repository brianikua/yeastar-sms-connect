/**
 * auto-report edge function
 * Called by pg_cron every hour. Reads report_schedule config from agent_config
 * and sends the report if the current UTC hour matches the configured schedule_hour.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Read schedule config
    const { data: configRow } = await supabase
      .from("agent_config")
      .select("config_value")
      .eq("config_key", "report_schedule")
      .maybeSingle();

    if (!configRow) {
      console.log("No report_schedule config found — skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "no_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const config = configRow.config_value as {
      enabled: boolean;
      hours: number;
      schedule_hour: number;
      send_email: boolean;
      send_telegram: boolean;
      send_sms: boolean;
      to_email?: string;
      sms_number?: string;
      sms_port?: number;
    };

    if (!config.enabled) {
      console.log("Auto-report is disabled — skipping");
      return new Response(JSON.stringify({ skipped: true, reason: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const currentHour = new Date().getUTCHours();
    if (currentHour !== config.schedule_hour) {
      console.log(`Current hour ${currentHour} != scheduled hour ${config.schedule_hour} — skipping`);
      return new Response(JSON.stringify({ skipped: true, reason: "not_scheduled_hour", current: currentHour, scheduled: config.schedule_hour }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Sending scheduled report for last ${config.hours}h via configured channels`);

    // Call the send-system-report function
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const res = await fetch(`${supabaseUrl}/functions/v1/send-system-report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        hours: config.hours || 24,
        send_email: config.send_email || false,
        send_telegram: config.send_telegram || false,
        send_sms: config.send_sms || false,
        to_email: config.to_email,
        sms_number: config.sms_number,
        sms_port: config.sms_port || 1,
      }),
    });

    const result = await res.json();
    console.log("Auto-report result:", result);

    if (!res.ok) {
      throw new Error(result.error || "Failed to send report");
    }

    // Log success
    await supabase.from("activity_logs").insert({
      event_type: "auto_report_sent",
      message: `Scheduled report sent automatically (last ${config.hours}h)`,
      severity: "success",
    });

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("auto-report error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
