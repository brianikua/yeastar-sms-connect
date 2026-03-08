import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Settings, Save, Loader2, Cpu, Server, MessageSquare, Bell, Terminal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { GatewaySettingsForm } from "./GatewaySettingsForm";
import { PbxSettingsForm } from "./PbxSettingsForm";
import { LocalAgentGuide } from "./LocalAgentGuide";
import { AutoReplyPanel } from "./AutoReplyPanel";
import { CallAutoSmsPanel } from "./CallAutoSmsPanel";
import { NotificationSettingsPanel } from "./NotificationSettingsPanel";

interface SimPortConfig {
  id: string;
  port_number: number;
  extension: string | null;
  label: string | null;
  enabled: boolean;
}

interface ConfigurationPanelProps {
  simPorts: SimPortConfig[];
  isLoading?: boolean;
  onConfigSaved?: () => void;
}

export const ConfigurationPanel = ({
  simPorts,
  isLoading = false,
  onConfigSaved,
}: ConfigurationPanelProps) => {
  const [isSaving, setIsSaving] = useState(false);
  const [localMappings, setLocalMappings] = useState<
    Record<number, { extension: string; label: string; enabled: boolean }>
  >({});

  useEffect(() => {
    const mappings: Record<number, { extension: string; label: string; enabled: boolean }> = {};
    simPorts.forEach((port) => {
      mappings[port.port_number] = {
        extension: port.extension || "",
        label: port.label || "",
        enabled: port.enabled,
      };
    });
    setLocalMappings(mappings);
  }, [simPorts]);

  const updateMapping = (
    portNumber: number,
    field: "extension" | "label" | "enabled",
    value: string | boolean
  ) => {
    setLocalMappings((prev) => ({
      ...prev,
      [portNumber]: { ...prev[portNumber], [field]: value },
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = simPorts.map((port) => {
        const mapping = localMappings[port.port_number];
        return supabase
          .from("sim_port_config")
          .update({
            extension: mapping?.extension?.trim() || null,
            label: mapping?.label?.trim() || null,
            enabled: mapping?.enabled ?? true,
          })
          .eq("id", port.id);
      });

      const results = await Promise.all(updates);
      const errors = results.filter((r) => r.error);
      if (errors.length > 0) throw new Error(errors[0].error?.message || "Failed to save");

      await supabase.from("activity_logs").insert({
        event_type: "config_update",
        message: "SIM port configuration updated",
        severity: "info",
        metadata: { updated_ports: Object.keys(localMappings).map(Number) },
      });

      toast({ title: "Configuration saved", description: "SIM port mappings updated." });
      onConfigSaved?.();
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="card-glow border-border/50 bg-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">Configuration</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-glow border-border/50 bg-card">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <CardTitle className="text-base font-semibold">Configuration</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <Tabs defaultValue="sim-ports" className="w-full">
          <TabsList className="w-full grid grid-cols-5 h-9">
            <TabsTrigger value="sim-ports" className="gap-1.5 text-xs px-2">
              <Cpu className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">SIM Ports</span>
            </TabsTrigger>
            <TabsTrigger value="connectivity" className="gap-1.5 text-xs px-2">
              <Server className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Connectivity</span>
            </TabsTrigger>
            <TabsTrigger value="messaging" className="gap-1.5 text-xs px-2">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Messaging</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5 text-xs px-2">
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Alerts</span>
            </TabsTrigger>
            <TabsTrigger value="agent" className="gap-1.5 text-xs px-2">
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Agent</span>
            </TabsTrigger>
          </TabsList>

          {/* SIM Ports Tab */}
          <TabsContent value="sim-ports" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-muted-foreground text-sm">SIM Port → Extension Mapping</Label>
              <Button size="sm" onClick={handleSave} disabled={isSaving} className="gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {simPorts.map((port) => {
                const mapping = localMappings[port.port_number] || { extension: "", label: "", enabled: true };
                return (
                  <div key={port.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded bg-primary/10 text-primary font-mono text-xs font-semibold">
                          {port.port_number}
                        </span>
                        <span className="text-sm font-medium">Port {port.port_number}</span>
                      </div>
                      <Switch
                        id={`enabled-${port.port_number}`}
                        checked={mapping.enabled}
                        onCheckedChange={(checked) => updateMapping(port.port_number, "enabled", checked)}
                      />
                    </div>
                    <div className="grid gap-2 grid-cols-2">
                      <Input
                        value={mapping.extension}
                        onChange={(e) => updateMapping(port.port_number, "extension", e.target.value)}
                        className="font-mono text-xs h-7 bg-muted/50 border-border/50"
                        placeholder="Ext (101)"
                        maxLength={10}
                      />
                      <Input
                        value={mapping.label}
                        onChange={(e) => updateMapping(port.port_number, "label", e.target.value)}
                        className="text-xs h-7 bg-muted/50 border-border/50"
                        placeholder="Label"
                        maxLength={50}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </TabsContent>

          {/* Connectivity Tab — Gateway + PBX side by side */}
          <TabsContent value="connectivity" className="mt-4 space-y-6">
            <GatewaySettingsForm />
            <div className="border-t border-border/30" />
            <PbxSettingsForm />
          </TabsContent>

          {/* Messaging Tab — Auto-Reply + Call Auto-SMS */}
          <TabsContent value="messaging" className="mt-4 space-y-6">
            <AutoReplyPanel />
            <div className="border-t border-border/30" />
            <CallAutoSmsPanel />
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="mt-4">
            <NotificationSettingsPanel />
          </TabsContent>

          {/* Local Agent Tab */}
          <TabsContent value="agent" className="mt-4">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Since your TG400 is on a private network, use a local agent to sync SMS messages.
              </p>
              <LocalAgentGuide />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
