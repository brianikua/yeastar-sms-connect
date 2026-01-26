import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardStats {
  totalMessages: number;
  activeSims: number;
  totalSims: number;
  unreadMessages: number;
}

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async (): Promise<DashboardStats> => {
      // Get total messages count
      const { count: totalMessages, error: msgError } = await supabase
        .from("sms_messages")
        .select("*", { count: "exact", head: true });

      if (msgError) throw msgError;

      // Get unread messages count
      const { count: unreadMessages, error: unreadError } = await supabase
        .from("sms_messages")
        .select("*", { count: "exact", head: true })
        .eq("status", "unread");

      if (unreadError) throw unreadError;

      // Get SIM port stats
      const { data: simConfigs, error: simError } = await supabase
        .from("sim_port_config")
        .select("enabled, last_seen_at");

      if (simError) throw simError;

      const totalSims = simConfigs?.length || 0;
      const activeSims = simConfigs?.filter((sim) => {
        if (!sim.enabled || !sim.last_seen_at) return false;
        const lastSeen = new Date(sim.last_seen_at);
        const now = new Date();
        const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
        return diffMinutes < 30;
      }).length || 0;

      return {
        totalMessages: totalMessages || 0,
        activeSims,
        totalSims,
        unreadMessages: unreadMessages || 0,
      };
    },
    refetchInterval: 30000,
  });
};
