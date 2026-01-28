import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PbxConfig {
  id: string;
  pbx_ip: string;
  pbx_port: number;
  api_username: string;
  api_password: string;
  web_port: number;
}

export const usePbxConfig = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["pbx-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pbx_config")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as PbxConfig;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<Omit<PbxConfig, "id">>) => {
      if (!config?.id) throw new Error("No config found");
      
      const { error } = await supabase
        .from("pbx_config")
        .update(updates)
        .eq("id", config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pbx-config"] });
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig,
  };
};
