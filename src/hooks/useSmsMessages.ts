import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export interface SmsMessage {
  id: string;
  sender: string;
  simPort: number;
  content: string;
  timestamp: string;
  isNew: boolean;
}

export const useSmsMessages = (limit = 50) => {
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
    refetchInterval: 10000, // Refetch every 10 seconds
  });
};
