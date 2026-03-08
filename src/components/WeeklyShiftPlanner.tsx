import { useState, DragEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAgents, useWeekSchedule, useCreateSchedule, useDeleteSchedule, Agent, ShiftScheduleEntry } from "@/hooks/useAgents";
import { ChevronLeft, ChevronRight, X, GripVertical } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, isSameDay } from "date-fns";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TIME_SLOTS = [
  { label: "06:00 – 10:00", start: "06:00", end: "10:00" },
  { label: "08:00 – 12:00", start: "08:00", end: "12:00" },
  { label: "08:00 – 17:00", start: "08:00", end: "17:00" },
  { label: "10:00 – 14:00", start: "10:00", end: "14:00" },
  { label: "12:00 – 18:00", start: "12:00", end: "18:00" },
  { label: "14:00 – 20:00", start: "14:00", end: "20:00" },
  { label: "17:00 – 22:00", start: "17:00", end: "22:00" },
  { label: "22:00 – 06:00", start: "22:00", end: "06:00" },
];

const AGENT_COLORS = [
  "bg-chart-1/20 border-chart-1/50 text-chart-1",
  "bg-chart-2/20 border-chart-2/50 text-chart-2",
  "bg-chart-3/20 border-chart-3/50 text-chart-3",
  "bg-chart-4/20 border-chart-4/50 text-chart-4",
  "bg-chart-5/20 border-chart-5/50 text-chart-5",
  "bg-primary/20 border-primary/50 text-primary",
  "bg-accent/40 border-accent text-accent-foreground",
  "bg-secondary border-secondary text-secondary-foreground",
];

export const WeeklyShiftPlanner = () => {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<string>("08:00 – 17:00");
  const [draggedAgent, setDraggedAgent] = useState<Agent | null>(null);

  const baseDate = addDays(new Date(), weekOffset * 7);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(baseDate, { weekStartsOn: 1 });
  const weekStartStr = format(weekStart, "yyyy-MM-dd");
  const weekEndStr = format(weekEnd, "yyyy-MM-dd");

  const { data: agents = [] } = useAgents();
  const { data: weekSchedule = [], isLoading } = useWeekSchedule(weekStartStr, weekEndStr);
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const today = new Date();

  // Build color map for agents
  const agentColorMap = new Map<string, string>();
  agents.forEach((a, i) => agentColorMap.set(a.id, AGENT_COLORS[i % AGENT_COLORS.length]));

  const getScheduleForDay = (date: Date): ShiftScheduleEntry[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return weekSchedule.filter((s) => s.shift_date === dateStr);
  };

  const handleDragStart = (e: DragEvent, agent: Agent) => {
    setDraggedAgent(agent);
    e.dataTransfer.setData("agent_id", agent.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: DragEvent, date: Date) => {
    e.preventDefault();
    const agentId = e.dataTransfer.getData("agent_id");
    if (!agentId) return;

    const slot = TIME_SLOTS.find((s) => `${s.start} – ${s.end}` === selectedSlot) || TIME_SLOTS[2];
    const dateStr = format(date, "yyyy-MM-dd");

    // Check if agent already scheduled for this day at this time
    const existing = weekSchedule.find(
      (s) => s.agent_id === agentId && s.shift_date === dateStr && s.start_time === slot.start
    );
    if (existing) {
      setDraggedAgent(null);
      return;
    }

    createSchedule.mutate({
      agent_id: agentId,
      shift_date: dateStr,
      start_time: slot.start,
      end_time: slot.end,
    });
    setDraggedAgent(null);
  };

  const handleRemoveShift = (id: string) => {
    deleteSchedule.mutate(id);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-sm font-medium">Weekly Shift Planner</CardTitle>
          <div className="flex items-center gap-2">
            <Select value={selectedSlot} onValueChange={setSelectedSlot}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_SLOTS.map((slot) => (
                  <SelectItem key={`${slot.start}-${slot.end}`} value={`${slot.start} – ${slot.end}`}>
                    {slot.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o - 1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setWeekOffset(0)}>
                This Week
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekOffset((o) => o + 1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {format(weekStart, "MMM d")} – {format(weekEnd, "MMM d, yyyy")} · Drag agents into day columns
        </p>
      </CardHeader>
      <CardContent>
        {/* Agent pool (drag source) */}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-2">Agents — drag to schedule</p>
          <div className="flex flex-wrap gap-2">
            {agents.map((agent) => (
              <div
                key={agent.id}
                draggable
                onDragStart={(e) => handleDragStart(e, agent)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium cursor-grab active:cursor-grabbing transition-all hover:shadow-sm",
                  agentColorMap.get(agent.id)
                )}
              >
                <GripVertical className="w-3 h-3 opacity-50" />
                {agent.name}
                {agent.extension && <span className="opacity-60">({agent.extension})</span>}
              </div>
            ))}
            {agents.length === 0 && (
              <p className="text-xs text-muted-foreground">No agents yet. Add agents from the Supervisor panel.</p>
            )}
          </div>
        </div>

        {/* Weekly calendar grid */}
        <div className="grid grid-cols-7 gap-1 min-h-[300px]">
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const daySchedule = getScheduleForDay(day);
            const isPast = day < today && !isToday;

            return (
              <div
                key={day.toISOString()}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day)}
                className={cn(
                  "border rounded-lg p-2 min-h-[200px] transition-colors",
                  isToday && "border-primary/50 bg-primary/5",
                  isPast && "opacity-60",
                  draggedAgent && "border-dashed border-primary/30 bg-primary/5"
                )}
              >
                {/* Day header */}
                <div className={cn("text-center mb-2 pb-1 border-b border-border/50")}>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {format(day, "EEE")}
                  </div>
                  <div className={cn(
                    "text-sm font-semibold",
                    isToday && "text-primary"
                  )}>
                    {format(day, "d")}
                  </div>
                </div>

                {/* Scheduled shifts */}
                <div className="space-y-1">
                  {daySchedule.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        "group relative rounded px-1.5 py-1 border text-[10px] leading-tight",
                        agentColorMap.get(entry.agent_id) || "bg-secondary border-border"
                      )}
                    >
                      <div className="font-medium truncate">{entry.agent?.name || "?"}</div>
                      <div className="opacity-70">{entry.start_time}–{entry.end_time}</div>
                      <button
                        onClick={() => handleRemoveShift(entry.id)}
                        className="absolute -top-1 -right-1 hidden group-hover:flex items-center justify-center w-4 h-4 rounded-full bg-destructive text-destructive-foreground"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}

                  {daySchedule.length === 0 && (
                    <div className="text-[10px] text-muted-foreground text-center pt-4 opacity-50">
                      Drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-[10px] text-muted-foreground">
          <span>📌 Selected slot: <Badge variant="outline" className="text-[10px] py-0">{selectedSlot}</Badge></span>
          <span>💡 Hover a shift to remove it</span>
        </div>
      </CardContent>
    </Card>
  );
};
