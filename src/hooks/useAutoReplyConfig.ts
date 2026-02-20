import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AutoReplyConfig {
  id: string;
  enabled: boolean;
  message: string;
  notification_email: string | null;
  created_at: string;
  updated_at: string;
}

export const useAutoReplyConfig = () => {
  return useQuery({
    queryKey: ["auto-reply-config"],
    queryFn: async (): Promise<AutoReplyConfig | null> => {
      const { data, error } = await supabase
        .from("auto_reply_config")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as AutoReplyConfig | null;
    },
  });
};

export const useUpdateAutoReplyConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: Partial<Pick<AutoReplyConfig, "enabled" | "message" | "notification_email">>) => {
      // First get the existing row id
      const { data: existing } = await supabase
        .from("auto_reply_config")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("auto_reply_config")
          .update(updates)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("auto_reply_config")
          .insert({
            enabled: updates.enabled ?? false,
            message: updates.message ?? "Thank you for your message. We will get back to you shortly.",
            notification_email: updates.notification_email ?? null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["auto-reply-config"] });
      toast.success("Auto-reply settings saved");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to save auto-reply settings");
    },
  });
};
