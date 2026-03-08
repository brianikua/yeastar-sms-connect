import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CallRecordsTable } from "@/components/CallRecordsTable";
import { CallStatsCards } from "@/components/CallStatsCards";
import { QuickDialWidget } from "@/components/QuickDialWidget";
import { CallQueueStatus } from "@/components/CallQueueStatus";
import { ContactsPanel } from "@/components/ContactsPanel";
import { useCallRecords, useCallStats } from "@/hooks/useCallRecords";

export const CommunicationsPanel = () => {
  const { data: calls = [], isLoading: callsLoading } = useCallRecords();
  const { data: callStats, isLoading: callStatsLoading } = useCallStats();

  return (
    <Tabs defaultValue="calls" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="calls">Call Records</TabsTrigger>
        <TabsTrigger value="contacts">Contacts</TabsTrigger>
      </TabsList>

      <TabsContent value="calls" className="space-y-6">
        <CallStatsCards stats={callStats} isLoading={callStatsLoading} />
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <CallRecordsTable calls={calls} isLoading={callsLoading} />
          </div>
          <div className="space-y-6">
            <QuickDialWidget />
            <CallQueueStatus />
          </div>
        </div>
      </TabsContent>

      <TabsContent value="contacts">
        <ContactsPanel />
      </TabsContent>
    </Tabs>
  );
};
