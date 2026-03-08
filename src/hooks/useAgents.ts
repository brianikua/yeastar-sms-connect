import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Agent {
  id: string;
  name: string;
  pin: string;
  email: string | null;
  phone: string | null;
  extension: string | null;
  telegram_chat_id: string | null;
  is_active: boolean;
  created_at: string;
}

const generatePin = () => {
  return String(Math.floor(1000 + Math.random() * 9000));
};

export interface AgentShift {
  id: string;
  agent_id: string;
  clock_in: string;
  clock_out: string | null;
  status: string;
  created_at: string;
  agent?: Agent;
}

export interface ShiftScheduleEntry {
  id: string;
  agent_id: string;
  shift_date: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  agent?: Agent;
}

export const useAgents = () => {
  return useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as Agent[];
    },
  });
};

export const useAllAgents = () => {
  return useQuery({
    queryKey: ["agents-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agents")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Agent[];
    },
  });
};

export const useActiveShifts = () => {
  return useQuery({
    queryKey: ["active-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_shifts")
        .select("*")
        .eq("status", "active")
        .is("clock_out", null);
      if (error) throw error;

      // Fetch agent details
      const agentIds = data.map((s: any) => s.agent_id);
      if (agentIds.length === 0) return [] as AgentShift[];

      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .in("id", agentIds);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      return data.map((s: any) => ({ ...s, agent: agentMap.get(s.agent_id) })) as AgentShift[];
    },
    refetchInterval: 30000,
  });
};

export const useTodayShifts = () => {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["today-shifts", today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_shifts")
        .select("*")
        .gte("clock_in", `${today}T00:00:00`)
        .lte("clock_in", `${today}T23:59:59`)
        .order("clock_in", { ascending: false });
      if (error) throw error;

      const agentIds = [...new Set(data.map((s: any) => s.agent_id))];
      if (agentIds.length === 0) return [] as AgentShift[];

      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .in("id", agentIds);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      return data.map((s: any) => ({ ...s, agent: agentMap.get(s.agent_id) })) as AgentShift[];
    },
    refetchInterval: 30000,
  });
};

export const useShiftSchedule = (date?: string) => {
  const targetDate = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["shift-schedule", targetDate],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_schedule")
        .select("*")
        .eq("shift_date", targetDate)
        .order("start_time");
      if (error) throw error;

      const agentIds = [...new Set(data.map((s: any) => s.agent_id))];
      if (agentIds.length === 0) return [] as ShiftScheduleEntry[];

      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .in("id", agentIds);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      return data.map((s: any) => ({ ...s, agent: agentMap.get(s.agent_id) })) as ShiftScheduleEntry[];
    },
  });
};

export const useClockIn = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (pin: string) => {
      // Find agent by PIN
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("*")
        .eq("pin", pin)
        .eq("is_active", true)
        .maybeSingle();

      if (agentError) throw agentError;
      if (!agent) throw new Error("Invalid PIN");

      // Check if already clocked in
      const { data: existing } = await supabase
        .from("agent_shifts")
        .select("id")
        .eq("agent_id", agent.id)
        .eq("status", "active")
        .is("clock_out", null)
        .maybeSingle();

      if (existing) {
        // Clock out
        const { error } = await supabase
          .from("agent_shifts")
          .update({ clock_out: new Date().toISOString(), status: "completed" })
          .eq("id", existing.id);
        if (error) throw error;
        // Send notification (fire and forget)
        supabase.functions.invoke("shift-notify", {
          body: { action: "clock_out", agent_name: agent.name, agent_email: agent.email, clock_time: new Date().toISOString() },
        });
        return { action: "clock_out" as const, agent };
      } else {
        // Clock in
        const { error } = await supabase
          .from("agent_shifts")
          .insert({ agent_id: agent.id, clock_in: new Date().toISOString(), status: "active" });
        if (error) throw error;
        // Send notification (fire and forget)
        supabase.functions.invoke("shift-notify", {
          body: { action: "clock_in", agent_name: agent.name, agent_email: agent.email, clock_time: new Date().toISOString() },
        });
        return { action: "clock_in" as const, agent };
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["active-shifts"] });
      queryClient.invalidateQueries({ queryKey: ["today-shifts"] });
      if (result.action === "clock_in") {
        toast.success(`${result.agent.name} clocked in`);
      } else {
        toast.success(`${result.agent.name} clocked out`);
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Clock in/out failed");
    },
  });
};

export const useCreateAgent = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (agent: { name: string; pin: string; email?: string; phone?: string; extension?: string }) => {
      const { data, error } = await supabase.from("agents").insert(agent).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
      queryClient.invalidateQueries({ queryKey: ["agents-all"] });
      toast.success("Agent created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create agent");
    },
  });
};

// Helper to check if two time ranges overlap
const timesOverlap = (start1: string, end1: string, start2: string, end2: string): boolean => {
  // Handle overnight shifts (e.g. 22:00-06:00)
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const s1 = toMinutes(start1), e1 = toMinutes(end1);
  const s2 = toMinutes(start2), e2 = toMinutes(end2);

  // For overnight shifts, the end is "next day" so it's always < start
  const isOvernight1 = e1 <= s1;
  const isOvernight2 = e2 <= s2;

  // Normalize to ranges within a 48h window
  const ranges1 = isOvernight1 ? [[s1, e1 + 1440]] : [[s1, e1]];
  const ranges2 = isOvernight2 ? [[s2, e2 + 1440]] : [[s2, e2]];

  return ranges1.some(([a, b]) => ranges2.some(([c, d]) => a < d && c < b));
};

export { timesOverlap };

export const useCreateSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { agent_id: string; shift_date: string; start_time: string; end_time: string; notes?: string }) => {
      // Check for overlapping shifts on the same day
      const { data: existing } = await supabase
        .from("shift_schedule")
        .select("id, start_time, end_time")
        .eq("agent_id", entry.agent_id)
        .eq("shift_date", entry.shift_date);

      const conflict = (existing || []).find((s: any) =>
        timesOverlap(entry.start_time, entry.end_time, s.start_time, s.end_time)
      );

      if (conflict) {
        throw new Error(`Conflict: agent already scheduled ${conflict.start_time}–${conflict.end_time} on this day`);
      }

      const { data, error } = await supabase.from("shift_schedule").insert(entry).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["week-schedule"] });
      toast.success("Shift scheduled");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to schedule shift");
    },
  });
};

export const useAgentDailyStats = () => {
  const today = new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["agent-daily-stats", today],
    queryFn: async () => {
      // Get today's shifts
      const { data: shifts } = await supabase
        .from("agent_shifts")
        .select("agent_id, clock_in, clock_out, status")
        .gte("clock_in", `${today}T00:00:00`);

      // Get today's call records
      const { data: calls } = await supabase
        .from("call_records")
        .select("extension, status, talk_duration, callback_attempted, direction")
        .gte("start_time", `${today}T00:00:00`);

      // Get agents
      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .eq("is_active", true);

      const stats = (agents || []).map((agent) => {
        const agentShifts = (shifts || []).filter((s: any) => s.agent_id === agent.id);
        const activeShift = agentShifts.find((s: any) => s.status === "active" && !s.clock_out);
        
        // Match calls by extension
        const agentCalls = agent.extension
          ? (calls || []).filter((c: any) => c.extension === agent.extension)
          : [];

        const totalCalls = agentCalls.length;
        const answered = agentCalls.filter((c: any) => c.status === "answered").length;
        const missed = agentCalls.filter((c: any) => c.status === "missed").length;
        const calledBack = agentCalls.filter((c: any) => c.callback_attempted).length;
        const totalTalkTime = agentCalls.reduce((sum: number, c: any) => sum + (c.talk_duration || 0), 0);
        const inbound = agentCalls.filter((c: any) => c.direction === "inbound").length;
        const outbound = agentCalls.filter((c: any) => c.direction === "outbound").length;

        // Calculate shift duration
        let shiftMinutes = 0;
        agentShifts.forEach((s: any) => {
          const start = new Date(s.clock_in);
          const end = s.clock_out ? new Date(s.clock_out) : new Date();
          shiftMinutes += (end.getTime() - start.getTime()) / 60000;
        });

        return {
          agent,
          isOnShift: !!activeShift,
          clockInTime: activeShift?.clock_in || null,
          totalCalls,
          answered,
          missed,
          calledBack,
          totalTalkTime,
          inbound,
          outbound,
          shiftMinutes: Math.round(shiftMinutes),
        };
      });

      return stats;
    },
    refetchInterval: 30000,
  });
};

export const useWeekSchedule = (weekStart: string, weekEnd: string) => {
  return useQuery({
    queryKey: ["week-schedule", weekStart, weekEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shift_schedule")
        .select("*")
        .gte("shift_date", weekStart)
        .lte("shift_date", weekEnd)
        .order("start_time");
      if (error) throw error;

      const agentIds = [...new Set(data.map((s: any) => s.agent_id))];
      if (agentIds.length === 0) return [] as ShiftScheduleEntry[];

      const { data: agents } = await supabase
        .from("agents")
        .select("*")
        .in("id", agentIds);

      const agentMap = new Map((agents || []).map((a: any) => [a.id, a]));
      return data.map((s: any) => ({ ...s, agent: agentMap.get(s.agent_id) })) as ShiftScheduleEntry[];
    },
  });
};

export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_schedule").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shift-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["week-schedule"] });
      toast.success("Shift removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove shift");
    },
  });
};

export const useReassignShift = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      shiftId,
      newAgentId,
      reason,
      originalAgent,
      newAgent,
      shiftDate,
      startTime,
      endTime,
    }: {
      shiftId: string;
      newAgentId: string;
      reason: string;
      originalAgent: Agent;
      newAgent: Agent;
      shiftDate: string;
      startTime: string;
      endTime: string;
    }) => {
      // Check for conflicts with the new agent
      const { data: existing } = await supabase
        .from("shift_schedule")
        .select("id, start_time, end_time")
        .eq("agent_id", newAgentId)
        .eq("shift_date", shiftDate)
        .neq("id", shiftId);

      const conflict = (existing || []).find((s: any) =>
        timesOverlap(startTime, endTime, s.start_time, s.end_time)
      );
      if (conflict) {
        throw new Error(`Conflict: ${newAgent.name} already has ${conflict.start_time}–${conflict.end_time} on this day`);
      }

      // Update the shift
      const { error } = await supabase
        .from("shift_schedule")
        .update({
          agent_id: newAgentId,
          notes: `Reassigned from ${originalAgent.name}: ${reason}`,
        })
        .eq("id", shiftId);
      if (error) throw error;

      // Send notification (fire and forget)
      supabase.functions.invoke("shift-notify", {
        body: {
          action: "reassign",
          original_agent_name: originalAgent.name,
          original_agent_email: originalAgent.email,
          new_agent_name: newAgent.name,
          new_agent_email: newAgent.email,
          shift_date: shiftDate,
          start_time: startTime,
          end_time: endTime,
          reason,
        },
      });

      // Log the activity
      await supabase.from("activity_logs").insert({
        event_type: "shift_reassign",
        message: `Shift on ${shiftDate} ${startTime}–${endTime} reassigned from ${originalAgent.name} to ${newAgent.name}. Reason: ${reason}`,
        severity: "warning",
      });

      return { originalAgent, newAgent };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["shift-schedule"] });
      queryClient.invalidateQueries({ queryKey: ["week-schedule"] });
      toast.success(`Shift reassigned from ${result.originalAgent.name} to ${result.newAgent.name}`);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to reassign shift");
    },
  });
};
