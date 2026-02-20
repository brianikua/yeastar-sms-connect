import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MissedCallRecord {
  id: string;
  caller_number: string;
  caller_name: string | null;
  callee_number: string;
  extension: string | null;
  sim_port: number | null;
  start_time: string;
  ring_duration: number;
  callback_attempted: boolean;
  callback_notes: string | null;
}

export const useMissedCallReport = () => {
  return useQuery({
    queryKey: ["missed-call-report"],
    queryFn: async (): Promise<MissedCallRecord[]> => {
      const { data, error } = await supabase
        .from("call_records")
        .select("id, caller_number, caller_name, callee_number, extension, sim_port, start_time, ring_duration, callback_attempted, callback_notes")
        .eq("status", "missed")
        .order("start_time", { ascending: false })
        .limit(200);

      if (error) throw error;
      return (data || []) as MissedCallRecord[];
    },
    refetchInterval: 30000,
  });
};

export const useMarkCallbackAttempted = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, callback_notes }: { id: string; callback_notes?: string }) => {
      const { error } = await supabase
        .from("call_records")
        .update({ callback_attempted: true, callback_notes: callback_notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["missed-call-report"] });
      queryClient.invalidateQueries({ queryKey: ["call-records"] });
      toast.success("Marked as callback attempted");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update record");
    },
  });
};

export const useSendMissedCallEmail = () => {
  return useMutation({
    mutationFn: async ({ call_id, to_email }: { call_id: string; to_email: string }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) throw new Error("Authentication required");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-missed-call-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ call_id, to_email }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Request failed: ${response.status}`);
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Missed call notification sent");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send email");
    },
  });
};
