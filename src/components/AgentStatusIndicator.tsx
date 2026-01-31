import { useAgentStatus } from "@/hooks/useAgentStatus";
import { StatusIndicator } from "./StatusIndicator";
import { Cpu, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AgentStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

export const AgentStatusIndicator = ({ 
  className, 
  showLabel = true 
}: AgentStatusIndicatorProps) => {
  const { data: agentStatus, isLoading } = useAgentStatus();

  const formatTimeSince = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusText = () => {
    if (isLoading) return "Checking...";
    if (!agentStatus) return "Unknown";
    
    switch (agentStatus.status) {
      case "online":
        return "Syncing";
      case "warning":
        return "Idle";
      case "offline":
        return "Offline";
    }
  };

  const getTooltipText = () => {
    if (isLoading) return "Checking agent status...";
    if (!agentStatus?.lastSyncAt) return "No agent activity detected. Is the local agent running?";
    
    const timeAgo = formatTimeSince(agentStatus.syncAgeSeconds);
    switch (agentStatus.status) {
      case "online":
        return `Local agent actively syncing. Last activity: ${timeAgo}`;
      case "warning":
        return `Agent idle. Last activity: ${timeAgo}. Check if the agent is still running.`;
      case "offline":
        return `Agent offline. Last activity: ${timeAgo}. The local agent may have stopped.`;
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border/50", className)}>
            <div className="relative">
              <Cpu className="w-4 h-4 text-muted-foreground" />
              {agentStatus?.status === "online" && (
                <RefreshCw className="absolute -top-1 -right-1 w-2.5 h-2.5 text-primary animate-spin" style={{ animationDuration: '3s' }} />
              )}
            </div>
            <StatusIndicator 
              status={isLoading ? "warning" : (agentStatus?.status || "offline")} 
              label={showLabel ? getStatusText() : undefined}
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
