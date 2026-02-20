import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

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
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { call_id, to_email } = body;

    if (!call_id || !to_email) {
      return new Response(
        JSON.stringify({ error: "call_id and to_email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch the call record
    const { data: call, error: callError } = await supabase
      .from("call_records")
      .select("*")
      .eq("id", call_id)
      .single();

    if (callError || !call) {
      return new Response(
        JSON.stringify({ error: "Call record not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const callerNumber = call.caller_number || "Unknown";
    const callerName = call.caller_name ? `${call.caller_name} (${callerNumber})` : callerNumber;
    const callTime = new Date(call.start_time).toLocaleString("en-GB", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
    const simPort = call.sim_port ? `SIM Port ${call.sim_port}` : "Unknown port";
    const extension = call.extension || "N/A";

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#f4f4f4;font-family:Arial,sans-serif;margin:0;padding:20px">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0">
    <div style="background:#1a2332;padding:24px 32px">
      <h1 style="color:#2dd4bf;margin:0;font-size:20px;font-weight:700;letter-spacing:0.5px">
        📞 Missed Call Alert
      </h1>
    </div>
    <div style="padding:32px">
      <p style="color:#333;font-size:15px;margin:0 0 24px">
        You have a missed call that requires a callback.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 0;color:#666;width:40%">Caller</td>
          <td style="padding:10px 0;color:#111;font-weight:600">${callerName}</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 0;color:#666">Called at</td>
          <td style="padding:10px 0;color:#111;font-weight:600">${callTime} UTC</td>
        </tr>
        <tr style="border-bottom:1px solid #f0f0f0">
          <td style="padding:10px 0;color:#666">Via</td>
          <td style="padding:10px 0;color:#111">${simPort} / Ext. ${extension}</td>
        </tr>
        <tr>
          <td style="padding:10px 0;color:#666">Status</td>
          <td style="padding:10px 0">
            <span style="background:#fee2e2;color:#dc2626;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600">
              MISSED — No Callback Yet
            </span>
          </td>
        </tr>
      </table>
      <div style="margin-top:28px;padding:16px;background:#fef9ec;border-left:4px solid #f59e0b;border-radius:4px">
        <p style="margin:0;color:#92400e;font-size:13px;">
          <strong>Action required:</strong> Please call back <strong>${callerNumber}</strong> at your earliest convenience. 
          Log this in the system when completed to remove it from the pending callbacks report.
        </p>
      </div>
    </div>
    <div style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb">
      <p style="margin:0;color:#9ca3af;font-size:12px">
        Sent by TG400 Dashboard · Missed Call Notification System
      </p>
    </div>
  </div>
</body>
</html>`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "TG400 Dashboard <onboarding@resend.dev>",
      to: [to_email],
      subject: `📞 Missed Call from ${callerNumber} — ${callTime}`,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(emailError.message);
    }

    return new Response(
      JSON.stringify({ success: true, email_id: emailData?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error sending missed call email:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
