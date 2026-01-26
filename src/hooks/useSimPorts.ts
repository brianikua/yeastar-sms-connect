import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SimPort {
  port: number;
  status: "online" | "offline" | "warning";
  phoneNumber: string;
  signalStrength: number;
  messageCount: number;
  mappedExtension?: string;
}

export const useSimPorts = () => {
  return useQuery({
    queryKey: ["sim-ports"],
    queryFn: async (): Promise<SimPort[]> => {
      // Fetch SIM port configs
      const { data: configs, error: configError } = await supabase
        .from("sim_port_config")
        .select("*")
        .order("port_number", { ascending: true });

      if (configError) throw configError;

      // Fetch message counts per SIM port
      const { data: messageCounts, error: countError } = await supabase
        .from("sms_messages")
        .select("sim_port");

      if (countError) throw countError;

      // Count messages per port
      const countsByPort = messageCounts?.reduce((acc, msg) => {
        acc[msg.sim_port] = (acc[msg.sim_port] || 0) + 1;
        return acc;
      }, {} as Record<number, number>) || {};

      return (configs || []).map((config) => {
        // Determine status based on enabled state and last_seen_at
        let status: "online" | "offline" | "warning" = "offline";
        if (config.enabled) {
          if (config.last_seen_at) {
            const lastSeen = new Date(config.last_seen_at);
            const now = new Date();
            const diffMinutes = (now.getTime() - lastSeen.getTime()) / (1000 * 60);
            
            if (diffMinutes < 5) {
              status = config.signal_strength && config.signal_strength < 50 ? "warning" : "online";
            } else if (diffMinutes < 30) {
              status = "warning";
            }
          }
        }

        return {
          port: config.port_number,
          status,
          phoneNumber: config.phone_number || "Not configured",
          signalStrength: config.signal_strength || 0,
          messageCount: countsByPort[config.port_number] || 0,
          mappedExtension: config.extension || undefined,
        };
      });
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};
