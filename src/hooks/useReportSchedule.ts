import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReportScheduleConfig {
  enabled: boolean;
  hours: number;
  schedule_hour: number; // 0-23 UTC
  send_email: boolean;
  send_telegram: boolean;
  send_sms: boolean;
  to_email: string;
  sms_number: string;
  sms_port: number;
}

const DEFAULT_CONFIG: ReportScheduleConfig = {
  enabled: false,
  hours: 24,
  schedule_hour: 8,
  send_email: false,
  send_telegram: false,
  send_sms: false,
  to_email: "",
  sms_number: "",
  sms_port: 1,
};

export const useReportSchedule = () => {
  return useQuery({
    queryKey: ["report-schedule"],
    queryFn: async (): Promise<ReportScheduleConfig> => {
      const { data, error } = await supabase
        .from("agent_config")
        .select("config_value")
        .eq("config_key", "report_schedule")
        .maybeSingle();

      if (error) throw error;
      if (!data) return DEFAULT_CONFIG;

      return { ...DEFAULT_CONFIG, ...(data.config_value as Partial<ReportScheduleConfig>) };
    },
  });
};

export const useUpdateReportSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (config: ReportScheduleConfig) => {
      const { data: existing } = await supabase
        .from("agent_config")
        .select("id")
        .eq("config_key", "report_schedule")
        .maybeSingle();

      // Cast config to Json-compatible type
      const configJson = config as unknown as import("@/integrations/supabase/types").Json;

      if (existing) {
        const { error } = await supabase
          .from("agent_config")
          .update({ config_value: configJson })
          .eq("config_key", "report_schedule");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("agent_config")
          .insert([{ config_key: "report_schedule", config_value: configJson }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-schedule"] });
      toast.success("Schedule saved");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save schedule");
    },
  });
};
