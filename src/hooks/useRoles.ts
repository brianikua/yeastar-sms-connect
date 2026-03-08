import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type AppRole = "super_admin" | "admin" | "operator" | "viewer";

export interface UserWithRole {
  user_id: string;
  email: string;
  role: AppRole;
  created_at: string;
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  operator: "Operator",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<AppRole, string> = {
  super_admin: "Full system access, role management, all admin powers",
  admin: "Manage agents, shifts, configuration, and system settings",
  operator: "Manage calls, contacts, SIM config, and daily operations",
  viewer: "Read-only access to dashboard, calls, and reports",
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: "bg-chart-5 text-white",
  admin: "bg-primary text-primary-foreground",
  operator: "bg-chart-2 text-white",
  viewer: "bg-muted text-muted-foreground",
};

export const ROLE_META = { labels: ROLE_LABELS, descriptions: ROLE_DESCRIPTIONS, colors: ROLE_COLORS };

export const useUsersWithRoles = () => {
  return useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async (): Promise<UserWithRole[]> => {
      // Get roles
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, role, created_at")
        .order("created_at");
      if (error) throw error;

      // We can't query auth.users from client, so we'll use the role data
      // and fetch emails via edge function
      const { data: result } = await supabase.functions.invoke("get-users-list", {
        body: { user_ids: roles.map((r) => r.user_id) },
      });

      const emailMap = new Map<string, string>();
      if (result?.users) {
        result.users.forEach((u: any) => emailMap.set(u.id, u.email));
      }

      return roles.map((r) => ({
        user_id: r.user_id,
        email: emailMap.get(r.user_id) || "Unknown",
        role: r.role as AppRole,
        created_at: r.created_at,
      }));
    },
  });
};

export const useCurrentUserRole = () => {
  return useQuery({
    queryKey: ["current-user-role"],
    queryFn: async (): Promise<AppRole | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      return (data?.role as AppRole) || null;
    },
  });
};

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: role as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users-with-roles"] });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update role");
    },
  });
};
