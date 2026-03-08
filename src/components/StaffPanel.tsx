import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClockInKiosk } from "@/components/ClockInKiosk";
import { SupervisorPanel } from "@/components/SupervisorPanel";

export const StaffPanel = () => {
  return (
    <Tabs defaultValue="kiosk" className="space-y-4">
      <TabsList className="flex flex-wrap h-auto gap-1">
        <TabsTrigger value="kiosk">Clock In/Out</TabsTrigger>
        <TabsTrigger value="supervisor">Supervisor</TabsTrigger>
      </TabsList>

      <TabsContent value="kiosk">
        <ClockInKiosk />
      </TabsContent>

      <TabsContent value="supervisor">
        <SupervisorPanel />
      </TabsContent>
    </Tabs>
  );
};
