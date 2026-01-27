import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GatewayConfig {
  id: string;
  gateway_ip: string;
  api_username: string;
  api_password: string;
}

export const useGatewayConfig = () => {
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ["gateway-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gateway_config")
        .select("*")
        .limit(1)
        .single();

      if (error) throw error;
      return data as GatewayConfig;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<Omit<GatewayConfig, "id">>) => {
      if (!config?.id) throw new Error("No config found");
      
      const { error } = await supabase
        .from("gateway_config")
        .update(updates)
        .eq("id", config.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gateway-config"] });
    },
  });

  return {
    config,
    isLoading,
    error,
    updateConfig,
  };
};
