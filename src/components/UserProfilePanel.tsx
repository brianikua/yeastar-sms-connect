import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Loader2, User, Mail, Star, BarChart3, Phone, PhoneMissed, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentUserRole, ROLE_META } from "@/hooks/useRoles";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { z } from "zod";
import { format, startOfDay, endOfDay } from "date-fns";

const passwordSchema = z.object({
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const useMyDailyReport = () => {
  return useQuery({
    queryKey: ["my-daily-report"],
    queryFn: async () => {
      const today = new Date();
      const start = startOfDay(today).toISOString();
      const end = endOfDay(today).toISOString();

      const { data: calls } = await supabase
        .from("call_records")
        .select("status, total_duration, talk_duration, direction")
        .gte("start_time", start)
        .lte("start_time", end);

      const totalCalls = calls?.length || 0;
      const answered = calls?.filter(c => c.status === "answered").length || 0;
      const missed = calls?.filter(c => c.status === "missed").length || 0;
      const totalTalkTime = calls?.reduce((sum, c) => sum + (c.talk_duration || 0), 0) || 0;
      const inbound = calls?.filter(c => c.direction === "inbound").length || 0;
      const outbound = calls?.filter(c => c.direction === "outbound").length || 0;

      return { totalCalls, answered, missed, totalTalkTime, inbound, outbound };
    },
  });
};

const useMyRatings = () => {
  return useQuery({
    queryKey: ["my-ratings"],
    queryFn: async () => {
      // Get all ratings - in a real system you'd filter by linked agent
      const { data } = await supabase
        .from("agent_ratings")
        .select("rating, comment, rating_date, created_at")
        .order("created_at", { ascending: false })
        .limit(10);

      const ratings = data || [];
      const avgRating = ratings.length > 0
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
        : 0;

      return { ratings, avgRating, totalRatings: ratings.length };
    },
  });
};

const formatDuration = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map(i => (
      <Star
        key={i}
        className={`w-4 h-4 ${i <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`}
      />
    ))}
  </div>
);

export const UserProfilePanel = () => {
  const { user } = useAuth();
  const { data: currentRole } = useCurrentUserRole();
  const { data: dailyReport } = useMyDailyReport();
  const { data: ratingsData } = useMyRatings();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPin, setNewPin] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPinUpdating, setIsPinUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const result = passwordSchema.safeParse({ newPassword, confirmPassword });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    setIsUpdating(true);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setError(updateError.message);
    } else {
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    }
    setIsUpdating(false);
  };

  const handleChangePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    if (!newPin || newPin.length < 4) {
      setPinError("PIN must be at least 4 digits");
      return;
    }
    setIsPinUpdating(true);
    // Find agent linked to this user email
    const { data: agent } = await supabase
      .from("agents")
      .select("id")
      .eq("email", user?.email || "")
      .maybeSingle();

    if (!agent) {
      setPinError("No agent profile linked to your account. Contact your admin.");
      setIsPinUpdating(false);
      return;
    }

    const { error } = await supabase
      .from("agents")
      .update({ pin: newPin })
      .eq("id", agent.id);

    if (error) {
      setPinError(error.message);
    } else {
      toast.success("Clock-in PIN updated");
      setNewPin("");
    }
    setIsPinUpdating(false);
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <User className="w-4 h-4" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-muted-foreground" />
            <div>
              <div className="text-sm font-medium">{user?.email}</div>
              <div className="text-xs text-muted-foreground">Email address</div>
            </div>
          </div>
          {currentRole && (
            <div className="flex items-center gap-3">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <div>
                <Badge className={ROLE_META.colors[currentRole]}>
                  {ROLE_META.labels[currentRole]}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1">{ROLE_META.descriptions[currentRole]}</div>
              </div>
            </div>
          )}
          {ratingsData && ratingsData.totalRatings > 0 && (
            <div className="flex items-center gap-3">
              <Star className="w-4 h-4 text-muted-foreground" />
              <div>
                <div className="flex items-center gap-2">
                  <StarRating rating={Math.round(ratingsData.avgRating)} />
                  <span className="text-sm font-medium">{ratingsData.avgRating.toFixed(1)}</span>
                  <span className="text-xs text-muted-foreground">({ratingsData.totalRatings} ratings)</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Report */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Today's Performance
          </CardTitle>
          <CardDescription>{format(new Date(), "EEEE, MMMM d, yyyy")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-5 h-5 text-primary" />
              <div>
                <div className="text-xl font-bold">{dailyReport?.totalCalls || 0}</div>
                <div className="text-xs text-muted-foreground">Total Calls</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-5 h-5 text-green-500" />
              <div>
                <div className="text-xl font-bold">{dailyReport?.answered || 0}</div>
                <div className="text-xs text-muted-foreground">Answered</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <PhoneMissed className="w-5 h-5 text-destructive" />
              <div>
                <div className="text-xl font-bold">{dailyReport?.missed || 0}</div>
                <div className="text-xs text-muted-foreground">Missed</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="w-5 h-5 text-blue-500" />
              <div>
                <div className="text-xl font-bold">{formatDuration(dailyReport?.totalTalkTime || 0)}</div>
                <div className="text-xs text-muted-foreground">Talk Time</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold">{dailyReport?.inbound || 0}</div>
                <div className="text-xs text-muted-foreground">Inbound</div>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Phone className="w-5 h-5 text-muted-foreground" />
              <div>
                <div className="text-xl font-bold">{dailyReport?.outbound || 0}</div>
                <div className="text-xs text-muted-foreground">Outbound</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ratings History */}
      {ratingsData && ratingsData.totalRatings > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Star className="w-4 h-4" />
              Recent Ratings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {ratingsData.ratings.map((r, i) => (
                <div key={i} className="flex items-start justify-between p-3 rounded-lg bg-muted/30">
                  <div className="space-y-1">
                    <StarRating rating={r.rating} />
                    {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">{r.rating_date}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security - Change Password & PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <KeyRound className="w-4 h-4" />
            Security
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="password">
            <TabsList className="mb-4">
              <TabsTrigger value="password">Change Password</TabsTrigger>
              <TabsTrigger value="pin">Change Clock-in PIN</TabsTrigger>
            </TabsList>
            <TabsContent value="password">
              <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                {error && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" disabled={isUpdating}>
                  {isUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update Password
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="pin">
              <form onSubmit={handleChangePin} className="space-y-4 max-w-md">
                {pinError && (
                  <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{pinError}</div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-pin">New Clock-in PIN</Label>
                  <Input
                    id="new-pin"
                    className="font-mono text-lg tracking-widest"
                    placeholder="Enter new PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    maxLength={6}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    This PIN is used for kiosk clock-in. Must be at least 4 digits.
                  </p>
                </div>
                <Button type="submit" disabled={isPinUpdating}>
                  {isPinUpdating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update PIN
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
