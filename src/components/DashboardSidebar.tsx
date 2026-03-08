import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  PhoneCall,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Shield,
  Crown,
  UserCircle,
} from "lucide-react";
import { usePendingSwapCount } from "@/hooks/useShiftSwap";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export type DashboardTab =
  | "dashboard"
  | "comms"
  | "insights"
  | "staff"
  | "roles"
  | "profile"
  | "config";

interface NavItem {
  id: DashboardTab;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "comms", label: "Calls & Contacts", icon: PhoneCall },
  { id: "insights", label: "Insights", icon: BarChart3 },
  { id: "staff", label: "Staff", icon: Shield },
  { id: "roles", label: "Roles", icon: Crown },
  { id: "config", label: "Configuration", icon: Settings },
];

interface DashboardSidebarProps {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
}

const NavItems = ({
  activeTab,
  onTabChange,
  collapsed,
  onItemClick,
}: {
  activeTab: DashboardTab;
  onTabChange: (tab: DashboardTab) => void;
  collapsed: boolean;
  onItemClick?: () => void;
}) => {
  const { data: pendingCount = 0 } = usePendingSwapCount();

  return (
    <nav className="flex-1 flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const isActive = activeTab === item.id;
        const badge = item.id === "staff" && pendingCount > 0 ? pendingCount : 0;
        const button = (
          <button
            key={item.id}
            onClick={() => {
              onTabChange(item.id);
              onItemClick?.();
            }}
            className={cn(
              "relative flex items-center gap-3 w-full rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0"
            )}
          >
            <item.icon className="w-4 h-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
            {badge > 0 && (
              <span className={cn(
                "flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1",
                collapsed ? "absolute -top-1 -right-1" : "ml-auto"
              )}>
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </button>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>{button}</TooltipTrigger>
              <TooltipContent side="right" className="bg-popover text-popover-foreground border-border">
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        }

        return button;
      })}
    </nav>
  );
};

export const DashboardSidebar = ({ activeTab, onTabChange }: DashboardSidebarProps) => {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    if (!isMobile) setMobileOpen(false);
  }, [isMobile]);

  // Mobile: floating trigger + sheet drawer
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="fixed bottom-4 left-4 z-50 h-12 w-12 rounded-full shadow-lg border-border/50 bg-card"
          >
            <Menu className="w-5 h-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] p-0 bg-sidebar border-border/50">
          <div className="flex items-center justify-between p-4 border-b border-border/50">
            <span className="text-sm font-semibold text-foreground">Navigation</span>
          </div>
          <div className="py-2">
            <NavItems
              activeTab={activeTab}
              onTabChange={onTabChange}
              collapsed={false}
              onItemClick={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: sticky sidebar
  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 h-screen flex flex-col border-r border-border/50 bg-sidebar transition-all duration-200 shrink-0",
          collapsed ? "w-[60px]" : "w-[200px]"
        )}
      >
        {/* Collapse toggle */}
        <div className={cn("flex items-center p-2", collapsed ? "justify-center" : "justify-end")}>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </Button>
        </div>

        <NavItems activeTab={activeTab} onTabChange={onTabChange} collapsed={collapsed} />
      </aside>
    </TooltipProvider>
  );
};
