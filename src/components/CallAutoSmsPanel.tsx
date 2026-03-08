import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Phone, PhoneMissed, PhoneCall, MessageSquare } from "lucide-react";
import { useCallAutoSmsConfig, useUpdateCallAutoSmsConfig } from "@/hooks/useCallAutoSmsConfig";

export const CallAutoSmsPanel = () => {
  const { data: config, isLoading } = useCallAutoSmsConfig();
  const updateConfig = useUpdateCallAutoSmsConfig();

  const [enabled, setEnabled] = useState(false);
  const [answeredMessage, setAnsweredMessage] = useState(
    "Thank you for calling us! We appreciate your business and are here to help anytime."
  );
  const [missedMessage, setMissedMessage] = useState(
    "We missed your call! Sorry we couldn't answer. We'll get back to you shortly. Your call is important to us."
  );

  useEffect(() => {
    if (config) {
      setEnabled(config.enabled);
      setAnsweredMessage(config.answered_message);
      setMissedMessage(config.missed_message);
    }
  }, [config]);

  const handleSave = () => {
    updateConfig.mutate({
      enabled,
      answered_message: answeredMessage,
      missed_message: missedMessage,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" />
          <Label className="text-muted-foreground font-medium">Call Auto-SMS</Label>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="call-autosms-enabled" className="text-xs text-muted-foreground">
              {enabled ? "Active" : "Inactive"}
            </Label>
            <Switch
              id="call-autosms-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateConfig.isPending}
            className="gap-1.5"
          >
            {updateConfig.isPending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            Save
          </Button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Automatically send SMS to callers after each call. Different messages are sent based on whether the call was answered or missed, helping build client trust and engagement.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <PhoneCall className="w-4 h-4 text-green-500" />
            <Label className="text-sm font-medium">Answered Call SMS</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Sent when a call is successfully answered — a thank-you follow-up.
          </p>
          <Textarea
            value={answeredMessage}
            onChange={(e) => setAnsweredMessage(e.target.value)}
            placeholder="Thank you for calling..."
            className="min-h-[100px] text-sm bg-background/50"
            maxLength={500}
          />
          <span className="text-[10px] text-muted-foreground">{answeredMessage.length}/500</span>
        </div>

        <div className="p-4 rounded-lg bg-muted/30 border border-border/30 space-y-2">
          <div className="flex items-center gap-2">
            <PhoneMissed className="w-4 h-4 text-destructive" />
            <Label className="text-sm font-medium">Missed Call SMS</Label>
          </div>
          <p className="text-xs text-muted-foreground">
            Sent when a call is missed — reassures the client you'll follow up.
          </p>
          <Textarea
            value={missedMessage}
            onChange={(e) => setMissedMessage(e.target.value)}
            placeholder="We missed your call..."
            className="min-h-[100px] text-sm bg-background/50"
            maxLength={500}
          />
          <span className="text-[10px] text-muted-foreground">{missedMessage.length}/500</span>
        </div>
      </div>
    </div>
  );
};
