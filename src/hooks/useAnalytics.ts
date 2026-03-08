import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, subDays, format } from "date-fns";

interface DailyMessageCount {
  date: string;
  count: number;
}

interface PortActivity {
  port: number;
  count: number;
}

interface HourlyDistribution {
  hour: number;
  count: number;
}

export interface ExtensionBreakdown {
  extension: string;
  label: string;
  port: number;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  calledBack: number;
  smsCount: number;
  totalTalkTime: number;
  avgTalkTime: number;
}

export interface AnalyticsData {
  dailyMessages: DailyMessageCount[];
  portActivity: PortActivity[];
  hourlyDistribution: HourlyDistribution[];
  totalMessages: number;
  averagePerDay: number;
  busiestPort: number | null;
  peakHour: number | null;
  extensionBreakdown: ExtensionBreakdown[];
}

export const useAnalytics = (days: number = 7) => {
  return useQuery({
    queryKey: ["analytics", days],
    queryFn: async (): Promise<AnalyticsData> => {
      const startDate = startOfDay(subDays(new Date(), days - 1));

      // Fetch messages from the last N days
      const { data: messages, error } = await supabase
        .from("sms_messages")
        .select("id, sim_port, received_at")
        .gte("received_at", startDate.toISOString())
        .order("received_at", { ascending: true });

      if (error) throw error;

      // Fetch sim port config for extension mapping
      const { data: portConfigs } = await supabase
        .from("sim_port_config")
        .select("port_number, extension, label");

      // Fetch call records for the period
      const { data: callRecords } = await supabase
        .from("call_records")
        .select("extension, sim_port, status, callback_attempted")
        .gte("start_time", startDate.toISOString());

      // Build extension breakdown
      const extMap = new Map<string, ExtensionBreakdown>();
      (portConfigs || []).forEach((pc) => {
        const ext = pc.extension || `Port ${pc.port_number}`;
        extMap.set(ext, {
          extension: ext,
          label: pc.label || ext,
          port: pc.port_number,
          totalCalls: 0,
          answeredCalls: 0,
          missedCalls: 0,
          calledBack: 0,
          smsCount: 0,
        });
      });

      // Count SMS per extension (via sim_port -> extension mapping)
      const portToExt = new Map<number, string>();
      (portConfigs || []).forEach((pc) => {
        portToExt.set(pc.port_number, pc.extension || `Port ${pc.port_number}`);
      });

      (messages || []).forEach((msg) => {
        const ext = portToExt.get(msg.sim_port);
        if (ext && extMap.has(ext)) {
          extMap.get(ext)!.smsCount += 1;
        }
      });

      // Count calls per extension
      (callRecords || []).forEach((cr) => {
        const ext = cr.extension || (cr.sim_port ? portToExt.get(cr.sim_port) : null);
        if (ext && extMap.has(ext)) {
          const entry = extMap.get(ext)!;
          entry.totalCalls += 1;
          if (cr.status === "answered") entry.answeredCalls += 1;
          if (cr.status === "missed") {
            entry.missedCalls += 1;
            if (cr.callback_attempted) entry.calledBack += 1;
          }
        }
      });

      const extensionBreakdown = Array.from(extMap.values()).sort((a, b) => a.port - b.port);

      // Process daily message counts
      const dailyMap = new Map<string, number>();
      for (let i = 0; i < days; i++) {
        const date = format(subDays(new Date(), days - 1 - i), "MMM d");
        dailyMap.set(date, 0);
      }

      // Process port activity
      const portMap = new Map<number, number>();
      [1, 2, 3, 4].forEach((port) => portMap.set(port, 0));

      // Process hourly distribution
      const hourlyMap = new Map<number, number>();
      for (let i = 0; i < 24; i++) {
        hourlyMap.set(i, 0);
      }

      // Count messages
      (messages || []).forEach((msg) => {
        const date = format(new Date(msg.received_at), "MMM d");
        const hour = new Date(msg.received_at).getHours();
        const port = msg.sim_port;

        if (dailyMap.has(date)) {
          dailyMap.set(date, (dailyMap.get(date) || 0) + 1);
        }
        portMap.set(port, (portMap.get(port) || 0) + 1);
        hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
      });

      const dailyMessages: DailyMessageCount[] = Array.from(dailyMap.entries()).map(
        ([date, count]) => ({ date, count })
      );

      const portActivity: PortActivity[] = Array.from(portMap.entries())
        .map(([port, count]) => ({ port, count }))
        .sort((a, b) => a.port - b.port);

      const hourlyDistribution: HourlyDistribution[] = Array.from(hourlyMap.entries())
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => a.hour - b.hour);

      const totalMessages = messages?.length || 0;
      const averagePerDay = totalMessages / days;

      const busiestPort =
        portActivity.length > 0
          ? portActivity.reduce((max, p) => (p.count > max.count ? p : max)).port
          : null;

      const peakHour =
        hourlyDistribution.length > 0
          ? hourlyDistribution.reduce((max, h) => (h.count > max.count ? h : max)).hour
          : null;

      return {
        dailyMessages,
        portActivity,
        hourlyDistribution,
        totalMessages,
        averagePerDay,
        busiestPort,
        peakHour,
        extensionBreakdown,
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });
};
