import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useEffect, useState, useCallback } from "react";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  isNew?: boolean;
}

export const useActivityLogs = (limit = 50) => {
  const queryClient = useQueryClient();
  const [isStreaming, setIsStreaming] = useState(false);

  const mapRow = useCallback(
    (log: { id: string; created_at: string; severity: string; message: string }, isNew = false): LogEntry => ({
      id: log.id,
      timestamp: format(new Date(log.created_at), "HH:mm:ss"),
      level: log.severity as LogEntry["level"],
      message: log.message,
      isNew,
    }),
    []
  );

  useEffect(() => {
    const channel = supabase
      .channel("activity-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_logs",
        },
        (payload) => {
          // Optimistically prepend the new entry
          queryClient.setQueryData<LogEntry[]>(["activity-logs", limit], (old) => {
            if (!old) return old;
            const newEntry = mapRow(payload.new as any, true);
            // Remove isNew flag from previous entries, prepend new one, keep limit
            const updated = old.map((e) => ({ ...e, isNew: false }));
            return [newEntry, ...updated].slice(0, limit);
          });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "activity_logs",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["activity-logs"] });
        }
      )
      .subscribe((status) => {
        setIsStreaming(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, limit, mapRow]);

  const query = useQuery({
    queryKey: ["activity-logs", limit],
    queryFn: async (): Promise<LogEntry[]> => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((log) => mapRow(log));
    },
    refetchInterval: 30000,
  });

  return { ...query, isStreaming };
};
