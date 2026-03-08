import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CallAutoSmsConfig {
  id: string;
  enabled: boolean;
  answered_message: string;
  missed_message: string;
  created_at: string;
  updated_at: string;
}

export const useCallAutoSmsConfig = () => {
  return useQuery({
    queryKey: ["call-autosms-config"],
    queryFn: async (): Promise<CallAutoSmsConfig | null> => {
      const { data, error } = await supabase
        .from("call_autosms_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as CallAutoSmsConfig | null;
    },
  });
};

export const useUpdateCallAutoSmsConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<CallAutoSmsConfig, "enabled" | "answered_message" | "missed_message">>) => {
      const { data: existing } = await supabase
        .from("call_autosms_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("call_autosms_config")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("call_autosms_config")
          .insert({
            enabled: updates.enabled ?? false,
            answered_message: updates.answered_message ?? "Thank you for calling us! We appreciate your business and are here to help anytime.",
            missed_message: updates.missed_message ?? "We missed your call! Sorry we couldn't answer. We'll get back to you shortly. Your call is important to us.",
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-autosms-config"] });
      toast.success("Call auto-SMS settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save call auto-SMS settings");
    },
  });
};
