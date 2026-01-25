import { useState } from "react";
import { Header } from "@/components/Header";
import { SimPortCard } from "@/components/SimPortCard";
import { SystemStatusCard } from "@/components/SystemStatusCard";
import { SmsInbox } from "@/components/SmsInbox";
import { ActivityLog } from "@/components/ActivityLog";
import { ConfigurationPanel } from "@/components/ConfigurationPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Server, Phone, Database, LayoutDashboard, Settings, FileText } from "lucide-react";
import { toast } from "sonner";

const Index = () => {
  const [lastSync, setLastSync] = useState("2024-01-15 14:32:05");

  const simPorts = [
    { port: 1, status: "online" as const, phoneNumber: "+1 555-0101", signalStrength: 85, messageCount: 24, mappedExtension: "101" },
    { port: 2, status: "online" as const, phoneNumber: "+1 555-0102", signalStrength: 72, messageCount: 18, mappedExtension: "102" },
    { port: 3, status: "warning" as const, phoneNumber: "+1 555-0103", signalStrength: 45, messageCount: 7, mappedExtension: "103" },
    { port: 4, status: "offline" as const, phoneNumber: "+1 555-0104", signalStrength: 0, messageCount: 0, mappedExtension: "104" },
  ];

  const messages = [
    { id: "1", sender: "+1 555-1234", simPort: 1, content: "Your verification code is 847291. Valid for 5 minutes.", timestamp: "14:32:05", isNew: true },
    { id: "2", sender: "+1 555-5678", simPort: 2, content: "Meeting reminder: Project review at 3 PM today in Conference Room B.", timestamp: "14:28:12", isNew: true },
    { id: "3", sender: "+1 555-9012", simPort: 1, content: "Thank you for your order #12345. Your shipment is on the way!", timestamp: "14:15:33", isNew: false },
    { id: "4", sender: "+1 555-3456", simPort: 3, content: "Server alert: CPU usage above 90% on production-db-01", timestamp: "13:58:47", isNew: false },
    { id: "5", sender: "+1 555-7890", simPort: 2, content: "Your appointment has been confirmed for tomorrow at 10 AM.", timestamp: "13:42:18", isNew: false },
    { id: "6", sender: "+1 555-2345", simPort: 1, content: "Low balance alert: Your account balance is below $50.", timestamp: "12:30:00", isNew: false },
  ];

  const logs = [
    { id: "1", timestamp: "14:32:05", level: "success" as const, message: "SMS retrieved from SIM 1: +1 555-1234" },
    { id: "2", timestamp: "14:30:00", level: "info" as const, message: "Polling TG400 gateway at 192.168.1.100" },
    { id: "3", timestamp: "14:28:12", level: "success" as const, message: "SMS retrieved from SIM 2: +1 555-5678" },
    { id: "4", timestamp: "14:25:00", level: "warning" as const, message: "SIM 3 signal strength below threshold (45%)" },
    { id: "5", timestamp: "14:20:00", level: "error" as const, message: "SIM 4 connection lost - retrying..." },
    { id: "6", timestamp: "14:15:00", level: "info" as const, message: "System health check completed" },
    { id: "7", timestamp: "14:10:00", level: "success" as const, message: "Message forwarded to S100 extension 101" },
    { id: "8", timestamp: "14:05:00", level: "info" as const, message: "Configuration loaded successfully" },
  ];

  const handleRefresh = () => {
    const now = new Date().toLocaleString("sv-SE").replace(",", "");
    setLastSync(now);
    toast.success("System data refreshed");
  };

  const handleSaveConfig = () => {
    toast.success("Configuration saved successfully");
  };

  return (
    <div className="min-h-screen bg-background">
      <Header systemStatus="online" lastSync={lastSync} onRefresh={handleRefresh} />

      <main className="container py-6">
        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-muted/50 border border-border/50">
            <TabsTrigger value="dashboard" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <FileText className="w-4 h-4" />
              Logs
            </TabsTrigger>
            <TabsTrigger value="config" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="w-4 h-4" />
              Configuration
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {/* System Status Row */}
            <div className="grid gap-4 md:grid-cols-3">
              <SystemStatusCard
                title="TG400 Gateway"
                status="online"
                statusLabel="Connected"
                icon={Server}
                details={[
                  { label: "IP Address", value: "192.168.1.100" },
                  { label: "Uptime", value: "5d 12h 34m" },
                  { label: "Active SIMs", value: "3/4" },
                ]}
              />
              <SystemStatusCard
                title="S100 PBX"
                status="online"
                statusLabel="Connected"
                icon={Phone}
                details={[
                  { label: "IP Address", value: "192.168.1.50" },
                  { label: "Extensions", value: "24 active" },
                  { label: "SMS Queue", value: "0 pending" },
                ]}
              />
              <SystemStatusCard
                title="Message Store"
                status="online"
                statusLabel="Healthy"
                icon={Database}
                details={[
                  { label: "Total Messages", value: "1,247" },
                  { label: "Storage Used", value: "12.4 MB" },
                  { label: "Oldest Message", value: "30 days" },
                ]}
              />
            </div>

            {/* SIM Ports Row */}
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-4">SIM Port Status</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {simPorts.map((sim) => (
                  <SimPortCard key={sim.port} {...sim} />
                ))}
              </div>
            </div>

            {/* Messages and Logs Row */}
            <div className="grid gap-6 lg:grid-cols-2">
              <SmsInbox messages={messages} />
              <ActivityLog logs={logs} />
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <ActivityLog logs={logs} />
          </TabsContent>

          <TabsContent value="config" className="space-y-6">
            <ConfigurationPanel
              gatewayIp="192.168.1.100"
              pollingInterval={30}
              simMappings={[
                { port: 1, extension: "101" },
                { port: 2, extension: "102" },
                { port: 3, extension: "103" },
                { port: 4, extension: "104" },
              ]}
              onSave={handleSaveConfig}
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Index;
