import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";
import { ActivityLog } from "@/components/ActivityLog";
import { AiAutomationPanel } from "@/components/AiAutomationPanel";
import { PredictiveMaintenancePanel } from "@/components/PredictiveMaintenancePanel";
import { ErrorLogsPanel } from "@/components/ErrorLogsPanel";
import { AiConfigPanel } from "@/components/AiConfigPanel";
import { TelegramPanel } from "@/components/TelegramPanel";
import { MissedCallsReportPanel } from "@/components/MissedCallsReportPanel";
import { useActivityLogs, type LogEntry } from "@/hooks/useActivityLogs";
import { Skeleton } from "@/components/ui/skeleton";

export const InsightsPanel = () => {
  const { data: logs = [], isLoading: logsLoading } = useActivityLogs();

  return (
    <Tabs defaultValue="analytics" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="analytics">Analytics</TabsTrigger>
        <TabsTrigger value="reports">Reports</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
        <TabsTrigger value="ai">AI & Diagnostics</TabsTrigger>
        <TabsTrigger value="telegram">Telegram</TabsTrigger>
      </TabsList>

      <TabsContent value="analytics">
        <AnalyticsDashboard />
      </TabsContent>

      <TabsContent value="reports">
        <MissedCallsReportPanel />
      </TabsContent>

      <TabsContent value="logs">
        {logsLoading ? (
          <Skeleton className="h-[400px] rounded-lg" />
        ) : (
          <ActivityLog logs={logs} />
        )}
      </TabsContent>

      <TabsContent value="ai" className="space-y-4">
        <AiAutomationPanel />
        <PredictiveMaintenancePanel />
        <div className="grid gap-4 lg:grid-cols-2">
          <ErrorLogsPanel />
          <AiConfigPanel />
        </div>
      </TabsContent>

      <TabsContent value="telegram">
        <TelegramPanel />
      </TabsContent>
    </Tabs>
  );
};
