import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Eye, EyeOff, Server } from "lucide-react";
import { useGatewayConfig } from "@/hooks/useGatewayConfig";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const GatewaySettingsForm = () => {
  const { config, isLoading, updateConfig } = useGatewayConfig();
  const [showPassword, setShowPassword] = useState(false);
  const [localConfig, setLocalConfig] = useState({
    gateway_ip: "",
    api_username: "",
    api_password: "",
  });

  useEffect(() => {
    if (config) {
      setLocalConfig({
        gateway_ip: config.gateway_ip || "",
        api_username: config.api_username || "",
        api_password: config.api_password || "",
      });
    }
  }, [config]);

  const handleSave = async () => {
    try {
      await updateConfig.mutateAsync(localConfig);

      // Log the configuration change
      await supabase.from("activity_logs").insert({
        event_type: "config_update",
        message: "Gateway configuration updated",
        severity: "info",
        metadata: { updated_fields: ["gateway_ip", "api_username", "api_password"] },
      });

      toast({
        title: "Gateway settings saved",
        description: "TG400 gateway configuration has been updated.",
      });
    } catch (error) {
      toast({
        title: "Save failed",
        description: error instanceof Error ? error.message : "Failed to save gateway settings",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-3">
        <Server className="w-4 h-4 text-muted-foreground" />
        <Label className="text-muted-foreground font-medium">TG400 Gateway Settings</Label>
      </div>
      
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="gateway-ip" className="text-xs text-muted-foreground">
            Gateway IP Address
          </Label>
          <Input
            id="gateway-ip"
            value={localConfig.gateway_ip}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, gateway_ip: e.target.value }))}
            className="font-mono text-sm h-9 bg-muted/50 border-border/50"
            placeholder="192.168.1.100"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="api-username" className="text-xs text-muted-foreground">
            API Username
          </Label>
          <Input
            id="api-username"
            value={localConfig.api_username}
            onChange={(e) => setLocalConfig((prev) => ({ ...prev, api_username: e.target.value }))}
            className="text-sm h-9 bg-muted/50 border-border/50"
            placeholder="admin"
          />
        </div>

        <div className="space-y-1">
          <Label htmlFor="api-password" className="text-xs text-muted-foreground">
            API Password
          </Label>
          <div className="relative">
            <Input
              id="api-password"
              type={showPassword ? "text" : "password"}
              value={localConfig.api_password}
              onChange={(e) => setLocalConfig((prev) => ({ ...prev, api_password: e.target.value }))}
              className="text-sm h-9 bg-muted/50 border-border/50 pr-9"
              placeholder="••••••••"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-9 w-9 px-2 hover:bg-transparent"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Eye className="h-4 w-4 text-muted-foreground" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateConfig.isPending}
          className="gap-2"
        >
          {updateConfig.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {updateConfig.isPending ? "Saving..." : "Save Gateway Settings"}
        </Button>
      </div>
    </div>
  );
};
