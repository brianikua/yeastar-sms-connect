import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart3, Mail, Send, Loader2, Clock, MessageSquare,
  Smartphone, CalendarClock, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAutoReplyConfig } from "@/hooks/useAutoReplyConfig";
import { useReportSchedule, useUpdateReportSchedule } from "@/hooks/useReportSchedule";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface SendReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOUR_PRESETS = [1, 6, 12, 24, 48, 72, 168];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: `${String(i).padStart(2, "0")}:00 UTC`,
}));

function periodLabel(hours: number) {
  if (hours >= 168) return "1 week";
  if (hours >= 48) return `${hours / 24} days`;
  if (hours >= 24) return "24 hours";
  return `${hours} hour${hours !== 1 ? "s" : ""}`;
}

export const SendReportDialog = ({ open, onOpenChange }: SendReportDialogProps) => {
  const { data: autoConfig } = useAutoReplyConfig();
  const { data: schedule } = useReportSchedule();
  const { mutate: saveSchedule, isPending: isSavingSchedule } = useUpdateReportSchedule();

  // Manual send state
  const [hours, setHours] = useState(24);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [sendSms, setSendSms] = useState(false);
  const [email, setEmail] = useState("");
  const [smsNumber, setSmsNumber] = useState("");
  const [smsPort, setSmsPort] = useState("1");
  const [isSending, setIsSending] = useState(false);

  // Schedule state (mirrors DB)
  const [schedEnabled, setSchedEnabled] = useState(false);
  const [schedHours, setSchedHours] = useState(24);
  const [schedHour, setSchedHour] = useState(8);
  const [schedEmail, setSchedEmail] = useState(false);
  const [schedTelegram, setSchedTelegram] = useState(false);
  const [schedSms, setSchedSms] = useState(false);
  const [schedToEmail, setSchedToEmail] = useState("");
  const [schedSmsNumber, setSchedSmsNumber] = useState("");
  const [schedSmsPort, setSchedSmsPort] = useState("1");

  const [activeTab, setActiveTab] = useState<"manual" | "schedule">("manual");

  // Populate schedule form from DB
  useEffect(() => {
    if (schedule) {
      setSchedEnabled(schedule.enabled);
      setSchedHours(schedule.hours);
      setSchedHour(schedule.schedule_hour);
      setSchedEmail(schedule.send_email);
      setSchedTelegram(schedule.send_telegram);
      setSchedSms(schedule.send_sms);
      setSchedToEmail(schedule.to_email || "");
      setSchedSmsNumber(schedule.sms_number || "");
      setSchedSmsPort(String(schedule.sms_port || 1));
    }
  }, [schedule]);

  const notifEmail = autoConfig?.notification_email || "";
  const effectiveEmail = email || notifEmail;
  const canSend = (sendEmail && effectiveEmail) || sendTelegram || (sendSms && smsNumber);
  const canSchedule = (schedEmail && schedToEmail) || schedTelegram || (schedSms && schedSmsNumber);

  const handleSend = async () => {
    if (!canSend) {
      toast.error("Select at least one delivery channel with required details.");
      return;
    }
    setIsSending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-system-report`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            hours,
            send_email: sendEmail,
            send_telegram: sendTelegram,
            send_sms: sendSms,
            to_email: sendEmail ? effectiveEmail : undefined,
            sms_number: sendSms ? smsNumber : undefined,
            sms_port: parseInt(smsPort, 10),
          }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed");

      const channels = [sendEmail && "Email", sendTelegram && "Telegram", sendSms && "SMS"].filter(Boolean).join(" & ");
      toast.success(`Report sent via ${channels} for the last ${periodLabel(hours)}!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send report");
    } finally {
      setIsSending(false);
    }
  };

  const handleSaveSchedule = () => {
    if (schedEnabled && !canSchedule) {
      toast.error("Select at least one delivery channel with required details.");
      return;
    }
    saveSchedule({
      enabled: schedEnabled,
      hours: schedHours,
      schedule_hour: schedHour,
      send_email: schedEmail,
      send_telegram: schedTelegram,
      send_sms: schedSms,
      to_email: schedToEmail,
      sms_number: schedSmsNumber,
      sms_port: parseInt(schedSmsPort, 10),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border/50 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">System Report</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Send now or configure an automatic schedule
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Tab switcher */}
        <div className="flex rounded-lg bg-muted/30 p-1 gap-1">
          {(["manual", "schedule"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "manual" ? <Send className="w-3.5 h-3.5" /> : <CalendarClock className="w-3.5 h-3.5" />}
              {tab === "manual" ? "Send Now" : "Auto Schedule"}
              {tab === "schedule" && schedule?.enabled && (
                <Badge className="h-4 text-[10px] px-1 bg-primary/20 text-primary border-0">ON</Badge>
              )}
            </button>
          ))}
        </div>

        {/* ======= MANUAL TAB ======= */}
        {activeTab === "manual" && (
          <div className="space-y-4">
            {/* Time window */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Report Period
                </Label>
                <span className="text-sm font-semibold text-primary">Last {periodLabel(hours)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HOUR_PRESETS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setHours(h)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      hours === h
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60"
                    }`}
                  >
                    {h >= 168 ? "1w" : h >= 48 ? `${h / 24}d` : h >= 24 ? "24h" : `${h}h`}
                  </button>
                ))}
              </div>
              <Slider min={1} max={168} step={1} value={[hours]} onValueChange={([v]) => setHours(v)} />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 hour</span><span>1 week</span>
              </div>
            </div>

            <Separator className="bg-border/40" />

            <Label className="text-sm font-medium">Delivery Channels</Label>

            {/* Email */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
              </div>
              {sendEmail && (
                <>
                  <Input type="email" placeholder={notifEmail || "recipient@example.com"} value={email}
                    onChange={(e) => setEmail(e.target.value)} className="text-sm h-8 bg-muted/30 border-border/50" />
                  {notifEmail && !email && (
                    <p className="text-xs text-muted-foreground">Using: <span className="font-medium">{notifEmail}</span></p>
                  )}
                </>
              )}
            </div>

            {/* SMS */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">SMS (via TG400)</span>
                </div>
                <Switch checked={sendSms} onCheckedChange={setSendSms} />
              </div>
              {sendSms && (
                <div className="space-y-2">
                  <Input placeholder="+254712345678" value={smsNumber}
                    onChange={(e) => setSmsNumber(e.target.value)} className="text-sm h-8 bg-muted/30 border-border/50" />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Send via SIM port</Label>
                    <Select value={smsPort} onValueChange={setSmsPort}>
                      <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((p) => (
                          <SelectItem key={p} value={String(p)} className="text-xs">Port {p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Telegram */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Telegram</span>
                </div>
                <Switch checked={sendTelegram} onCheckedChange={setSendTelegram} />
              </div>
              {sendTelegram && <p className="text-xs text-muted-foreground mt-1.5">Sends to configured bot &amp; chat.</p>}
            </div>

            {/* Report content preview */}
            <div className="rounded-lg bg-muted/20 border border-border/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground/70">Report includes:</p>
              <p>• Call logs: total, answered, missed, not answered, in/outbound</p>
              <p>• SMS total &amp; unread with category breakdown</p>
              <p>• Missed call list with callback status</p>
              <p>• Active SIMs &amp; unresolved errors</p>
            </div>

            <Button className="w-full gap-2" disabled={!canSend || isSending} onClick={handleSend}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isSending ? "Sending…" : `Send Report (Last ${periodLabel(hours)})`}
            </Button>
          </div>
        )}

        {/* ======= SCHEDULE TAB ======= */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {/* Enable toggle */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Auto-send reports</p>
                <p className="text-xs text-muted-foreground mt-0.5">Automatically sends at the configured hour daily</p>
              </div>
              <Switch checked={schedEnabled} onCheckedChange={setSchedEnabled} />
            </div>

            {/* Time settings */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  Report Period
                </Label>
                <span className="text-xs font-semibold text-primary">Last {periodLabel(schedHours)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {HOUR_PRESETS.map((h) => (
                  <button key={h} type="button" onClick={() => setSchedHours(h)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      schedHours === h
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60"
                    }`}>
                    {h >= 168 ? "1w" : h >= 48 ? `${h / 24}d` : h >= 24 ? "24h" : `${h}h`}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground flex items-center gap-2">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Send time (UTC)
                </Label>
                <Select value={String(schedHour)} onValueChange={(v) => setSchedHour(parseInt(v, 10))}>
                  <SelectTrigger className="text-sm bg-muted/30 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-48">
                    {HOUR_OPTIONS.map(({ value, label }) => (
                      <SelectItem key={value} value={String(value)} className="text-sm">{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Runs every hour — sends only at the selected UTC hour</p>
              </div>
            </div>

            <Separator className="bg-border/40" />

            <Label className="text-sm font-medium">Delivery Channels</Label>

            {/* Schedule Email */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <Switch checked={schedEmail} onCheckedChange={setSchedEmail} />
              </div>
              {schedEmail && (
                <Input type="email" placeholder={notifEmail || "recipient@example.com"} value={schedToEmail}
                  onChange={(e) => setSchedToEmail(e.target.value)} className="text-sm h-8 bg-muted/30 border-border/50" />
              )}
            </div>

            {/* Schedule SMS */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">SMS (via TG400)</span>
                </div>
                <Switch checked={schedSms} onCheckedChange={setSchedSms} />
              </div>
              {schedSms && (
                <div className="space-y-2">
                  <Input placeholder="+254712345678" value={schedSmsNumber}
                    onChange={(e) => setSchedSmsNumber(e.target.value)} className="text-sm h-8 bg-muted/30 border-border/50" />
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">SIM port</Label>
                    <Select value={schedSmsPort} onValueChange={setSchedSmsPort}>
                      <SelectTrigger className="h-8 text-xs bg-muted/30 border-border/50 w-24">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4].map((p) => (
                          <SelectItem key={p} value={String(p)} className="text-xs">Port {p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Telegram */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Telegram</span>
                </div>
                <Switch checked={schedTelegram} onCheckedChange={setSchedTelegram} />
              </div>
            </div>

            {schedEnabled && (
              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-primary flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Schedule Preview
                </p>
                <p>Every day at <strong>{String(schedHour).padStart(2, "0")}:00 UTC</strong>, a report covering the <strong>last {periodLabel(schedHours)}</strong> will be sent via{" "}
                  {[schedEmail && "Email", schedSms && "SMS", schedTelegram && "Telegram"].filter(Boolean).join(", ") || "no channels selected"}.
                </p>
              </div>
            )}

            <Button className="w-full gap-2" disabled={isSavingSchedule} onClick={handleSaveSchedule}>
              {isSavingSchedule ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Save Schedule
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
