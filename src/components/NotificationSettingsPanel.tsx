import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Mail, MessageSquare, Send as SendIcon, Save, Loader2, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface NotificationConfig {
  email_enabled: boolean;
  email_recipients: string[];
  sms_enabled: boolean;
  sms_recipients: string[];
  telegram_enabled: boolean;
  telegram_bot_token: string;
  telegram_chat_id: string;
  notify_missed_calls: boolean;
  notify_new_sms: boolean;
  notify_system_errors: boolean;
  notify_shift_changes: boolean;
  daily_report_enabled: boolean;
  daily_report_time: string;
}

const DEFAULT_CONFIG: NotificationConfig = {
  email_enabled: false,
  email_recipients: [],
  sms_enabled: false,
  sms_recipients: [],
  telegram_enabled: false,
  telegram_bot_token: "",
  telegram_chat_id: "",
  notify_missed_calls: true,
  notify_new_sms: false,
  notify_system_errors: true,
  notify_shift_changes: true,
  daily_report_enabled: false,
  daily_report_time: "18:00",
};

const useNotificationConfig = () => {
  return useQuery({
    queryKey: ["notification-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_config")
        .select("config_value")
        .eq("config_key", "notification_settings")
        .maybeSingle();
      
      if (data?.config_value) {
        return { ...DEFAULT_CONFIG, ...(data.config_value as any) } as NotificationConfig;
      }
      return DEFAULT_CONFIG;
    },
  });
};

const useSaveNotificationConfig = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (config: NotificationConfig) => {
      const { error } = await supabase
        .from("agent_config")
        .upsert({
          config_key: "notification_settings",
          config_value: config as any,
          updated_at: new Date().toISOString(),
        }, { onConflict: "config_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-config"] });
      toast.success("Notification settings saved");
    },
    onError: (err: Error) => toast.error(err.message),
  });
};

export const NotificationSettingsPanel = () => {
  const { data: config, isLoading } = useNotificationConfig();
  const saveConfig = useSaveNotificationConfig();
  const [local, setLocal] = useState<NotificationConfig>(DEFAULT_CONFIG);
  const [newEmail, setNewEmail] = useState("");
  const [newSms, setNewSms] = useState("");

  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  const update = <K extends keyof NotificationConfig>(key: K, value: NotificationConfig[K]) => {
    setLocal(prev => ({ ...prev, [key]: value }));
  };

  const addEmail = () => {
    const email = newEmail.trim();
    if (email && !local.email_recipients.includes(email)) {
      update("email_recipients", [...local.email_recipients, email]);
      setNewEmail("");
    }
  };

  const removeEmail = (email: string) => {
    update("email_recipients", local.email_recipients.filter(e => e !== email));
  };

  const addSms = () => {
    const num = newSms.trim();
    if (num && !local.sms_recipients.includes(num)) {
      update("sms_recipients", [...local.sms_recipients, num]);
      setNewSms("");
    }
  };

  const removeSms = (num: string) => {
    update("sms_recipients", local.sms_recipients.filter(n => n !== num));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-muted-foreground flex items-center gap-2">
          <Bell className="w-4 h-4" />
          Notification Channels
        </Label>
        <Button
          size="sm"
          onClick={() => saveConfig.mutate(local)}
          disabled={saveConfig.isPending}
          className="gap-2"
        >
          {saveConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </Button>
      </div>

      <Tabs defaultValue="email">
        <TabsList className="w-full">
          <TabsTrigger value="email" className="flex-1 gap-2">
            <Mail className="w-4 h-4" />
            Email
          </TabsTrigger>
          <TabsTrigger value="sms" className="flex-1 gap-2">
            <MessageSquare className="w-4 h-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="telegram" className="flex-1 gap-2">
            <SendIcon className="w-4 h-4" />
            Telegram
          </TabsTrigger>
        </TabsList>

        {/* Email Tab */}
        <TabsContent value="email" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Label>Enable Email Notifications</Label>
            <Switch checked={local.email_enabled} onCheckedChange={v => update("email_enabled", v)} />
          </div>
          {local.email_enabled && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Recipients</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addEmail())}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addEmail}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {local.email_recipients.length > 0 && (
                <div className="space-y-2">
                  {local.email_recipients.map(email => (
                    <div key={email} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/30">
                      <span className="text-sm font-mono">{email}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeEmail(email)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* SMS Tab */}
        <TabsContent value="sms" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Label>Enable SMS Notifications</Label>
            <Switch checked={local.sms_enabled} onCheckedChange={v => update("sms_enabled", v)} />
          </div>
          {local.sms_enabled && (
            <div className="space-y-3">
              <Label className="text-xs text-muted-foreground">Recipients (phone numbers)</Label>
              <div className="flex gap-2">
                <Input
                  type="tel"
                  placeholder="+254700000000"
                  value={newSms}
                  onChange={e => setNewSms(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addSms())}
                  className="flex-1"
                />
                <Button size="sm" variant="outline" onClick={addSms}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              {local.sms_recipients.length > 0 && (
                <div className="space-y-2">
                  {local.sms_recipients.map(num => (
                    <div key={num} className="flex items-center justify-between p-2 rounded bg-muted/30 border border-border/30">
                      <span className="text-sm font-mono">{num}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeSms(num)}>
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                SMS notifications are sent via TG400 gateway SIM ports.
              </p>
            </div>
          )}
        </TabsContent>

        {/* Telegram Tab */}
        <TabsContent value="telegram" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <Label>Enable Telegram Notifications</Label>
            <Switch checked={local.telegram_enabled} onCheckedChange={v => update("telegram_enabled", v)} />
          </div>
          {local.telegram_enabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="tg-bot-token" className="text-xs text-muted-foreground">Bot Token</Label>
                <Input
                  id="tg-bot-token"
                  type="password"
                  placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                  value={local.telegram_bot_token}
                  onChange={e => update("telegram_bot_token", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tg-chat-id" className="text-xs text-muted-foreground">Chat ID</Label>
                <Input
                  id="tg-chat-id"
                  placeholder="-1001234567890"
                  value={local.telegram_chat_id}
                  onChange={e => update("telegram_chat_id", e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Get your bot token from @BotFather and chat ID from @userinfobot on Telegram.
              </p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Notification Events */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Notification Events</CardTitle>
          <CardDescription className="text-xs">Choose which events trigger notifications</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Missed Calls</Label>
            <Switch checked={local.notify_missed_calls} onCheckedChange={v => update("notify_missed_calls", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">New SMS Messages</Label>
            <Switch checked={local.notify_new_sms} onCheckedChange={v => update("notify_new_sms", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">System Errors</Label>
            <Switch checked={local.notify_system_errors} onCheckedChange={v => update("notify_system_errors", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Shift Changes</Label>
            <Switch checked={local.notify_shift_changes} onCheckedChange={v => update("notify_shift_changes", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Daily Report */}
      <Card className="border-border/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily Report</CardTitle>
          <CardDescription className="text-xs">Automated daily performance summary</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Enable Daily Report</Label>
            <Switch checked={local.daily_report_enabled} onCheckedChange={v => update("daily_report_enabled", v)} />
          </div>
          {local.daily_report_enabled && (
            <div className="space-y-2">
              <Label htmlFor="report-time" className="text-xs text-muted-foreground">Send Time (UTC)</Label>
              <Input
                id="report-time"
                type="time"
                value={local.daily_report_time}
                onChange={e => update("daily_report_time", e.target.value)}
                className="w-32"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
