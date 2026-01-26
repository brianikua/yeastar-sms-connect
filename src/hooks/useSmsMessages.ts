import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useEffect } from "react";

export interface SmsMessage {
  id: string;
  sender: string;
  simPort: number;
  content: string;
  timestamp: string;
  isNew: boolean;
}

export const useSmsMessages = (limit = 50) => {
  const queryClient = useQueryClient();

  // Subscribe to realtime changes
  useEffect(() => {
    const channel = supabase
      .channel("sms-messages-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sms_messages",
        },
        () => {
          // Invalidate and refetch on any change
          queryClient.invalidateQueries({ queryKey: ["sms-messages"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ["sms-messages", limit],
    queryFn: async (): Promise<SmsMessage[]> => {
      const { data, error } = await supabase
        .from("sms_messages")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((msg) => ({
        id: msg.id,
        sender: msg.sender_number,
        simPort: msg.sim_port,
        content: msg.message_content,
        timestamp: format(new Date(msg.received_at), "HH:mm:ss"),
        isNew: msg.status === "unread",
      }));
    },
    refetchInterval: 30000, // Fallback polling every 30 seconds
  });
};
