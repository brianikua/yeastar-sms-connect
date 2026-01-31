import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect } from "react";

export interface AgentStatus {
  isConnected: boolean;
  lastSyncAt: Date | null;
  syncAgeSeconds: number;
  status: "online" | "warning" | "offline";
}

// Agent is considered:
// - "online" if synced within last 2 minutes
// - "warning" if synced within last 5 minutes
// - "offline" if no sync in over 5 minutes
const ONLINE_THRESHOLD_SECONDS = 120;
const WARNING_THRESHOLD_SECONDS = 300;

export const useAgentStatus = () => {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes on activity_logs to detect agent activity
  useEffect(() => {
    const channel = supabase
      .channel("agent-status-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["agent-status"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["agent-status"],
    queryFn: async (): Promise<AgentStatus> => {
      // Check for recent agent activity by looking for agent-specific log entries
      const { data, error } = await supabase
        .from("activity_logs")
        .select("created_at, event_type, message")
        .or("event_type.eq.agent_poll,event_type.eq.sms_received,event_type.eq.agent_sync,message.ilike.%agent%,message.ilike.%poll%,message.ilike.%sync%")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw error;

      const lastSync = data?.[0]?.created_at ? new Date(data[0].created_at) : null;
      const now = new Date();
      const syncAgeSeconds = lastSync 
        ? Math.floor((now.getTime() - lastSync.getTime()) / 1000) 
        : Infinity;

      let status: "online" | "warning" | "offline";
      if (syncAgeSeconds <= ONLINE_THRESHOLD_SECONDS) {
        status = "online";
      } else if (syncAgeSeconds <= WARNING_THRESHOLD_SECONDS) {
        status = "warning";
      } else {
        status = "offline";
      }

      return {
        isConnected: status !== "offline",
        lastSyncAt: lastSync,
        syncAgeSeconds,
        status,
      };
    },
    refetchInterval: 30000, // Check every 30 seconds
  });
};
