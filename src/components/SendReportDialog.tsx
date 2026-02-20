import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Mail, Send, Loader2, Clock, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAutoReplyConfig } from "@/hooks/useAutoReplyConfig";

interface SendReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const HOUR_PRESETS = [1, 6, 12, 24, 48, 72, 168];

export const SendReportDialog = ({ open, onOpenChange }: SendReportDialogProps) => {
  const { data: autoConfig } = useAutoReplyConfig();

  const [hours, setHours] = useState(24);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [email, setEmail] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Pre-fill email from config when dialog opens
  const notifEmail = autoConfig?.notification_email || "";

  const effectiveEmail = email || notifEmail;

  const periodLabel = hours >= 168
    ? "1 week"
    : hours >= 48
    ? `${hours / 24} days`
    : hours >= 24
    ? "24 hours"
    : `${hours} hour${hours !== 1 ? "s" : ""}`;

  const canSend = (sendEmail && effectiveEmail) || sendTelegram;

  const handleSend = async () => {
    if (!canSend) {
      toast.error("Please select at least one delivery method and provide an email address if sending via email.");
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
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            hours,
            send_email: sendEmail,
            send_telegram: sendTelegram,
            to_email: sendEmail ? effectiveEmail : undefined,
          }),
        }
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to send report");

      const channels = [sendEmail && "Email", sendTelegram && "Telegram"].filter(Boolean).join(" & ");
      toast.success(`Report sent via ${channels} for the last ${periodLabel}!`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send report");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/50">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Send System Report</DialogTitle>
              <DialogDescription className="text-xs mt-0.5">
                Aggregate data summary for a chosen time window
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Time window */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Report Period
              </Label>
              <span className="text-sm font-semibold text-primary">
                Last {periodLabel}
              </span>
            </div>

            {/* Preset chips */}
            <div className="flex flex-wrap gap-2">
              {HOUR_PRESETS.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHours(h)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    hours === h
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/30 text-muted-foreground border-border/40 hover:bg-muted/60"
                  }`}
                >
                  {h >= 168 ? "1 week" : h >= 48 ? `${h / 24}d` : h >= 24 ? "24h" : `${h}h`}
                </button>
              ))}
            </div>

            {/* Custom slider */}
            <div className="space-y-2">
              <Slider
                min={1}
                max={168}
                step={1}
                value={[hours]}
                onValueChange={([v]) => setHours(v)}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1 hour</span>
                <span>1 week</span>
              </div>
            </div>
          </div>

          <Separator className="bg-border/40" />

          {/* Delivery channels */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Delivery Channels</Label>

            {/* Email */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Email</span>
                </div>
                <Switch
                  checked={sendEmail}
                  onCheckedChange={setSendEmail}
                />
              </div>
              {sendEmail && (
                <Input
                  type="email"
                  placeholder={notifEmail || "recipient@example.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="text-sm h-8 bg-muted/30 border-border/50"
                />
              )}
              {sendEmail && notifEmail && !email && (
                <p className="text-xs text-muted-foreground">
                  Using notification email: <span className="font-medium">{notifEmail}</span>
                </p>
              )}
            </div>

            {/* Telegram */}
            <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Telegram</span>
                </div>
                <Switch
                  checked={sendTelegram}
                  onCheckedChange={setSendTelegram}
                />
              </div>
              {sendTelegram && (
                <p className="text-xs text-muted-foreground mt-1.5">
                  Sends to the configured Telegram bot &amp; chat.
                </p>
              )}
            </div>
          </div>

          {/* Report preview */}
          <div className="rounded-lg bg-muted/20 border border-border/30 p-3 text-xs text-muted-foreground space-y-1">
            <p className="font-medium text-foreground/70">Report includes:</p>
            <p>• SMS count, categories &amp; unread breakdown</p>
            <p>• Call stats: answered, missed, inbound/outbound</p>
            <p>• Missed call list with callback status</p>
            <p>• Active SIM ports &amp; unresolved errors</p>
          </div>

          {/* Send button */}
          <Button
            className="w-full gap-2"
            disabled={!canSend || isSending}
            onClick={handleSend}
          >
            {isSending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {isSending ? "Sending Report…" : `Send Report (Last ${periodLabel})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
