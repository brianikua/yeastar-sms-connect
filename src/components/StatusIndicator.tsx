import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "offline" | "warning";
  label?: string;
  className?: string;
}

export const StatusIndicator = ({ status, label, className }: StatusIndicatorProps) => {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span
        className={cn(
          "status-dot",
          status === "online" && "status-online",
          status === "offline" && "status-offline",
          status === "warning" && "status-warning"
        )}
      />
      {label && (
        <span className="text-sm text-muted-foreground">{label}</span>
      )}
    </div>
  );
};
