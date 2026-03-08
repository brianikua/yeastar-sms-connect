import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface StatusIndicatorProps {
  status: "online" | "offline" | "warning";
  label?: string;
  className?: string;
}

export const StatusIndicator = forwardRef<HTMLDivElement, StatusIndicatorProps>(
  ({ status, label, className, ...props }, ref) => {
    return (
      <div ref={ref} className={cn("flex items-center gap-2", className)} {...props}>
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
  }
);

StatusIndicator.displayName = "StatusIndicator";
