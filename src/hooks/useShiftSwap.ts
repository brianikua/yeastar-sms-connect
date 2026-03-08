import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Agent, ShiftScheduleEntry } from "@/hooks/useAgents";

export interface ShiftSwapRequest {
  id: string;
  requester_agent_id: string;
  requester_shift_id: string;
  target_agent_id: string;
  target_shift_id: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  requester_agent?: Agent;
  target_agent?: Agent;
  requester_shift?: ShiftScheduleEntry;
  target_shift?: ShiftScheduleEntry;
}

export const useSwapRequests = () => {
  return useQuery({
    queryKey: ["swap-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_swap_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows = data as any[];
      if (!rows.length) return [] as ShiftSwapRequest[];

      // Fetch related agents and shifts
      const agentIds = [...new Set(rows.flatMap((r: any) => [r.requester_agent_id, r.target_agent_id]))];
      const shiftIds = [...new Set(rows.flatMap((r: any) => [r.requester_shift_id, r.target_shift_id]))];

      const [{ data: agents }, { data: shifts }] = await Promise.all([
        supabase.from("agents").select("*").in("id", agentIds),
        supabase.from("shift_schedule").select("*").in("id", shiftIds),
      ]);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      const shiftMap = new Map((shifts || []).map((s: any) => [s.id, s]));

      return rows.map((r: any) => ({
        ...r,
        requester_agent: agentMap.get(r.requester_agent_id),
        target_agent: agentMap.get(r.target_agent_id),
        requester_shift: shiftMap.get(r.requester_shift_id),
        target_shift: shiftMap.get(r.target_shift_id),
      })) as ShiftSwapRequest[];
    },
    refetchInterval: 30000,
  });
};

export const usePendingSwapCount = () => {
  return useQuery({
    queryKey: ["swap-requests-pending-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("shift_swap_requests" as any)
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });
};

export const useCreateSwapRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      requesterAgentId,
      requesterShiftId,
      targetAgentId,
      targetShiftId,
      reason,
      requesterAgent,
      targetAgent,
      requesterShift,
      targetShift,
    }: {
      requesterAgentId: string;
      requesterShiftId: string;
      targetAgentId: string;
      targetShiftId: string;
      reason: string;
      requesterAgent: Agent;
      targetAgent: Agent;
      requesterShift: ShiftScheduleEntry;
      targetShift: ShiftScheduleEntry;
    }) => {
      const { error } = await supabase
        .from("shift_swap_requests" as any)
        .insert({
          requester_agent_id: requesterAgentId,
          requester_shift_id: requesterShiftId,
          target_agent_id: targetAgentId,
          target_shift_id: targetShiftId,
          reason,
        } as any);
      if (error) throw error;

      // Send notification
      supabase.functions.invoke("shift-notify", {
        body: {
          action: "swap_request",
          requester_name: requesterAgent.name,
          target_name: targetAgent.name,
          requester_shift_date: requesterShift.shift_date,
          requester_shift_time: `${requesterShift.start_time}–${requesterShift.end_time}`,
          target_shift_date: targetShift.shift_date,
          target_shift_time: `${targetShift.start_time}–${targetShift.end_time}`,
          reason,
        },
      });

      return { requesterAgent, targetAgent };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["swap-requests-pending-count"] });
      toast.success(`Swap request sent: ${result.requesterAgent.name} ↔ ${result.targetAgent.name}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create swap request");
    },
  });
};

export const useApproveSwapRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, reviewNote }: { request: ShiftSwapRequest; reviewNote?: string }) => {
      // Perform the actual swap: update both shifts' agent_ids
      const [res1, res2] = await Promise.all([
        supabase
          .from("shift_schedule")
          .update({
            agent_id: request.target_agent_id,
            notes: `Swapped from ${request.requester_agent?.name}: ${request.reason}`,
          })
          .eq("id", request.requester_shift_id),
        supabase
          .from("shift_schedule")
          .update({
            agent_id: request.requester_agent_id,
            notes: `Swapped from ${request.target_agent?.name}: ${request.reason}`,
          })
          .eq("id", request.target_shift_id),
      ]);

      if (res1.error) throw res1.error;
      if (res2.error) throw res2.error;

      // Update swap request status
      const { error } = await supabase
        .from("shift_swap_requests" as any)
        .update({
          status: "approved",
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
        } as any)
        .eq("id", request.id);
      if (error) throw error;

      // Send notification
      supabase.functions.invoke("shift-notify", {
        body: {
          action: "swap_approved",
          requester_name: request.requester_agent?.name,
          requester_email: request.requester_agent?.email,
          target_name: request.target_agent?.name,
          target_email: request.target_agent?.email,
          requester_shift_date: request.requester_shift?.shift_date,
          requester_shift_time: `${request.requester_shift?.start_time}–${request.requester_shift?.end_time}`,
          target_shift_date: request.target_shift?.shift_date,
          target_shift_time: `${request.target_shift?.start_time}–${request.target_shift?.end_time}`,
          reason: request.reason,
        },
      });

      // Log
      await supabase.from("activity_logs").insert({
        event_type: "shift_swap_approved",
        message: `Shift swap approved: ${request.requester_agent?.name} ↔ ${request.target_agent?.name}`,
        severity: "info",
      });

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["swap-requests-pending-count"] });
      queryClient.invalidateQueries({ queryKey: ["shift-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["week-schedule"] });
      toast.success("Swap approved and shifts updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to approve swap");
    },
  });
};

export const useRejectSwapRequest = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ request, reviewNote }: { request: ShiftSwapRequest; reviewNote?: string }) => {
      const { error } = await supabase
        .from("shift_swap_requests" as any)
        .update({
          status: "rejected",
          reviewed_at: new Date().toISOString(),
          review_note: reviewNote || null,
        } as any)
        .eq("id", request.id);
      if (error) throw error;

      // Send notification
      supabase.functions.invoke("shift-notify", {
        body: {
          action: "swap_rejected",
          requester_name: request.requester_agent?.name,
          requester_email: request.requester_agent?.email,
          target_name: request.target_agent?.name,
          target_email: request.target_agent?.email,
          reason: request.reason,
          review_note: reviewNote,
        },
      });

      return request;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["swap-requests"] });
      queryClient.invalidateQueries({ queryKey: ["swap-requests-pending-count"] });
      toast.success("Swap request rejected");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reject swap");
    },
  });
};
