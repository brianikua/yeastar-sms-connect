import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
}

export const useActivityLogs = (limit = 50) => {
  return useQuery({
    queryKey: ["activity-logs", limit],
    queryFn: async (): Promise<LogEntry[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log) => ({
        id: log.id,
        timestamp: format(new Date(log.created_at), "HH:mm:ss"),
        level: log.severity,
        message: log.message,
      }));
    },
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};
