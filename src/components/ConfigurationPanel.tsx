import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Settings, Save } from "lucide-react";

interface SimMapping {
  port: number;
  extension: string;
}

interface ConfigurationPanelProps {
  gatewayIp: string;
  pollingInterval: number;
  simMappings: SimMapping[];
  onSave: () => void;
}

export const ConfigurationPanel = ({
  gatewayIp,
  pollingInterval,
  simMappings,
  onSave,
}: ConfigurationPanelProps) => {
  return (
    <Card className="card-glow border-border/50 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <Settings className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">Configuration</CardTitle>
          </div>
          <Button size="sm" onClick={onSave} className="gap-2">
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gateway-ip" className="text-muted-foreground">
              TG400 Gateway IP
            </Label>
            <Input
              id="gateway-ip"
              defaultValue={gatewayIp}
              className="font-mono bg-muted/50 border-border/50"
              placeholder="192.168.1.100"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="polling" className="text-muted-foreground">
              Polling Interval (seconds)
            </Label>
            <Input
              id="polling"
              type="number"
              defaultValue={pollingInterval}
              className="font-mono bg-muted/50 border-border/50"
              placeholder="30"
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-muted-foreground">SIM to Extension Mapping</Label>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {simMappings.map((mapping) => (
              <div
                key={mapping.port}
                className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/30"
              >
                <span className="flex items-center justify-center w-8 h-8 rounded bg-primary/10 text-primary font-mono text-sm font-semibold">
                  {mapping.port}
                </span>
                <span className="text-muted-foreground">→</span>
                <Input
                  defaultValue={mapping.extension}
                  className="font-mono text-sm h-8 bg-muted/50 border-border/50"
                  placeholder="Ext..."
                />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="api-user" className="text-muted-foreground">
              API Username
            </Label>
            <Input
              id="api-user"
              defaultValue="admin"
              className="font-mono bg-muted/50 border-border/50"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="api-pass" className="text-muted-foreground">
              API Password
            </Label>
            <Input
              id="api-pass"
              type="password"
              defaultValue="••••••••"
              className="font-mono bg-muted/50 border-border/50"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
