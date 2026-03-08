import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { ActivityLog } from "@/components/ActivityLog";
import { AiAutomationPanel } from "@/components/AiAutomationPanel";
import { PredictiveMaintenancePanel } from "@/components/PredictiveMaintenancePanel";
import { ErrorLogsPanel } from "@/components/ErrorLogsPanel";
import { AiConfigPanel } from "@/components/AiConfigPanel";
import { TelegramPanel } from "@/components/TelegramPanel";
import { MissedCallsReportPanel } from "@/components/MissedCallsReportPanel";
import { GatewaySettingsForm } from "@/components/GatewaySettingsForm";
import { PbxSettingsForm } from "@/components/PbxSettingsForm";
import { AutoReplyPanel } from "@/components/AutoReplyPanel";
import { NotificationSettingsPanel } from "@/components/NotificationSettingsPanel";
import { LocalAgentGuide } from "@/components/LocalAgentGuide";
import { SimPortConfigSection } from "@/components/SimPortConfigSection";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  FileText,
  ScrollText,
  BrainCircuit,
  Send,
  Router,
  Phone,
  MessageSquareReply,
  Bell,
  Cpu,
  ScanLine,
} from "lucide-react";

type Section =
  | "analytics"
  | "reports"
  | "logs"
  | "ai"
  | "telegram"
  | "gateway"
  | "pbx"
  | "sim"
  | "auto-reply"
  | "notifications"
  | "agent";

interface SectionItem {
  id: Section;
  label: string;
  icon: React.ElementType;
  group: "insights" | "config";
}

const sections: SectionItem[] = [
  { id: "analytics", label: "Analytics", icon: BarChart3, group: "insights" },
  { id: "reports", label: "Reports", icon: FileText, group: "insights" },
  { id: "logs", label: "Logs", icon: ScrollText, group: "insights" },
  { id: "ai", label: "AI & Diagnostics", icon: BrainCircuit, group: "insights" },
  { id: "telegram", label: "Telegram", icon: Send, group: "insights" },
  { id: "gateway", label: "Gateway", icon: Router, group: "config" },
  { id: "pbx", label: "PBX", icon: Phone, group: "config" },
  { id: "sim", label: "SIM Ports", icon: Sim, group: "config" },
  { id: "auto-reply", label: "Auto Reply", icon: MessageSquareReply, group: "config" },
  { id: "notifications", label: "Notifications", icon: Bell, group: "config" },
  { id: "agent", label: "Local Agent", icon: Cpu, group: "config" },
];

interface InsightsPanelProps {
  simConfigs?: any[];
  simLoading?: boolean;
  onConfigSaved?: () => void;
}

export const InsightsPanel = ({ simConfigs = [], simLoading = false, onConfigSaved }: InsightsPanelProps) => {
  const [active, setActive] = useState<Section>("analytics");
  const { data: logs = [], isLoading: logsLoading } = useActivityLogs();

  const insightSections = sections.filter(s => s.group === "insights");
  const configSections = sections.filter(s => s.group === "config");

  return (
    <div className="space-y-4">
      {/* Navigation Buttons */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Insights</p>
          <div className="flex flex-wrap gap-2">
            {insightSections.map(s => (
              <Button
                key={s.id}
                variant={active === s.id ? "default" : "outline"}
                size="sm"
                className={cn("gap-2", active === s.id && "shadow-md")}
                onClick={() => setActive(s.id)}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </Button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Configuration</p>
          <div className="flex flex-wrap gap-2">
            {configSections.map(s => (
              <Button
                key={s.id}
                variant={active === s.id ? "default" : "outline"}
                size="sm"
                className={cn("gap-2", active === s.id && "shadow-md")}
                onClick={() => setActive(s.id)}
              >
                <s.icon className="w-4 h-4" />
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-[400px]">
        {active === "analytics" && <AnalyticsDashboard />}

        {active === "reports" && <MissedCallsReportPanel />}

        {active === "logs" && (
          logsLoading ? <Skeleton className="h-[400px] rounded-lg" /> : <ActivityLog logs={logs} />
        )}

        {active === "ai" && (
          <div className="space-y-4">
            <AiAutomationPanel />
            <PredictiveMaintenancePanel />
            <div className="grid gap-4 lg:grid-cols-2">
              <ErrorLogsPanel />
              <AiConfigPanel />
            </div>
          </div>
        )}

        {active === "telegram" && <TelegramPanel />}

        {active === "gateway" && <GatewaySettingsForm />}

        {active === "pbx" && <PbxSettingsForm />}

        {active === "sim" && (
          <SimPortConfigSection
            simPorts={simConfigs}
            isLoading={simLoading}
            onConfigSaved={onConfigSaved}
          />
        )}

        {active === "auto-reply" && <AutoReplyPanel />}

        {active === "notifications" && <NotificationSettingsPanel />}

        {active === "agent" && (
          <div className="p-4 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-sm text-muted-foreground mb-3">
              Since your TG400 is on a private network, use a local agent to sync SMS messages.
            </p>
            <LocalAgentGuide />
          </div>
        )}
      </div>
    </div>
  );
};
