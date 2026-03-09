import { useState, useEffect, useCallback } from "react";
import { Radio, RefreshCw, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "./StatusIndicator";
import { AgentStatusIndicator } from "./AgentStatusIndicator";
import { UserProfilePanel } from "./UserProfilePanel";
import { useAuth, signOut } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface HeaderProps {
  systemStatus: "online" | "offline" | "warning";
  lastSync: string;
  onRefresh: () => void;
}

export const Header = ({ systemStatus, lastSync, onRefresh }: HeaderProps) => {
  const { user, role, isAdmin } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState(Date.now());

  // Reset timer when lastSync changes (indicates new data)
  useEffect(() => {
    setLastRefreshTime(Date.now());
    setSecondsAgo(0);
  }, [lastSync]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastRefreshTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [lastRefreshTime]);

  const formatAgo = useCallback((s: number) => {
    if (s < 5) return "just now";
    if (s < 60) return `${s}s ago`;
    return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  }, []);

  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const getRoleBadgeVariant = () => {
    if (role === "super_admin") return "destructive";
    if (role === "admin") return "default";
    if (role === "operator") return "secondary";
    return "outline";
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 md:h-16 items-center justify-between gap-2 px-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg bg-primary/10 shrink-0">
                <Radio className="w-4 h-4 md:w-5 md:h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm md:text-lg font-semibold tracking-tight truncate">
                  SMS Gateway Manager
                </h1>
                <p className="text-[10px] md:text-xs text-muted-foreground font-mono hidden sm:block">
                  Yeastar TG400 + S100
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-6 shrink-0">
            <div className="hidden md:flex items-center gap-4 text-sm">
              <AgentStatusIndicator />
              <div className="h-4 w-px bg-border" />
              <StatusIndicator status={systemStatus} label="System" />
              <div className="h-4 w-px bg-border" />
              <span className="text-muted-foreground flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  {systemStatus === "online" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                    </>
                  ) : systemStatus === "warning" ? (
                    <>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-yellow-500"></span>
                    </>
                  ) : (
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  )}
                </span>
                Synced: <span className="font-mono text-foreground">{formatAgo(secondsAgo)}</span>
              </span>
            </div>
            {/* Mobile: compact status dot only */}
            <div className="flex md:hidden items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                {systemStatus === "online" ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </>
                ) : systemStatus === "warning" ? (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                ) : (
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                )}
              </span>
              <span className="font-mono">{formatAgo(secondsAgo)}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              className="gap-2 border-border/50 hover:bg-muted/50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden md:inline max-w-[120px] truncate">
                    {user?.email?.split("@")[0]}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col gap-1">
                    <span className="truncate">{user?.email}</span>
                    <Badge variant={getRoleBadgeVariant()} className="w-fit text-xs">
                      {role || "user"}
                    </Badge>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                  <User className="w-4 h-4 mr-2" />
                  My Profile
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>
          <UserProfilePanel />
        </DialogContent>
      </Dialog>
    </>
  );
};