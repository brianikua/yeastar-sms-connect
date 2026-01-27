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

export interface AnalyticsData {
  dailyMessages: DailyMessageCount[];
  portActivity: PortActivity[];
  hourlyDistribution: HourlyDistribution[];
  totalMessages: number;
  averagePerDay: number;
  busiestPort: number | null;
  peakHour: number | null;
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
      };
    },
    refetchInterval: 60000, // Refetch every minute
  });
};
