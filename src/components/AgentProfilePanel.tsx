import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAgents, useUpdateAgent, type Agent } from "@/hooks/useAgents";
import { UserCog, Eye, EyeOff, KeyRound, Save, Send } from "lucide-react";
import { toast } from "sonner";

export const AgentProfilePanel = () => {
  const { data: agents = [] } = useAgents();
  const updateAgent = useUpdateAgent();
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const [form, setForm] = useState({
    pin: "",
    email: "",
    phone: "",
    extension: "",
    telegram_chat_id: "",
  });

  const openProfile = (agent: Agent) => {
    setSelectedAgent(agent);
    setForm({
      pin: "",
      email: agent.email || "",
      phone: agent.phone || "",
      extension: agent.extension || "",
      telegram_chat_id: agent.telegram_chat_id || "",
    });
    setShowPin(false);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!selectedAgent) return;
    const updates: Record<string, string | undefined> = {};
    if (form.pin && form.pin.length >= 4) updates.pin = form.pin;
    if (form.email !== (selectedAgent.email || "")) updates.email = form.email || undefined;
    if (form.phone !== (selectedAgent.phone || "")) updates.phone = form.phone || undefined;
    if (form.extension !== (selectedAgent.extension || "")) updates.extension = form.extension || undefined;
    if (form.telegram_chat_id !== (selectedAgent.telegram_chat_id || "")) updates.telegram_chat_id = form.telegram_chat_id || undefined;

    if (Object.keys(updates).length === 0) {
      toast.info("No changes to save");
      return;
    }

    updateAgent.mutate(
      { id: selectedAgent.id, ...updates },
      { onSuccess: () => setDialogOpen(false) }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <UserCog className="w-4 h-4" />
          Agent Profiles
        </CardTitle>
        <CardDescription>Manage PINs, contact info, and Telegram IDs</CardDescription>
      </CardHeader>
      <CardContent>
        {agents.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agents configured</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => openProfile(agent)}
                className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-accent/50 text-left transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {agent.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">{agent.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.extension ? `Ext ${agent.extension}` : "No ext"}
                    {agent.telegram_chat_id ? " · 📱 TG" : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Profile — {selectedAgent?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="flex items-center gap-1"><KeyRound className="w-3 h-3" /> Change PIN</Label>
                <div className="flex gap-2">
                  <Input
                    type={showPin ? "text" : "password"}
                    placeholder="Enter new 4-6 digit PIN"
                    value={form.pin}
                    onChange={(e) => setForm({ ...form, pin: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                    maxLength={6}
                    className="font-mono"
                  />
                  <Button variant="ghost" size="icon" onClick={() => setShowPin(!showPin)}>
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Leave blank to keep current PIN</p>
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label>Extension</Label>
                <Input value={form.extension} onChange={(e) => setForm({ ...form, extension: e.target.value })} placeholder="e.g. 8001" />
              </div>
              <div>
                <Label className="flex items-center gap-1"><Send className="w-3 h-3" /> Telegram Chat ID</Label>
                <Input
                  value={form.telegram_chat_id}
                  onChange={(e) => setForm({ ...form, telegram_chat_id: e.target.value })}
                  placeholder="Agent's personal Telegram chat ID"
                />
                <p className="text-xs text-muted-foreground mt-1">Agent will receive shift & performance notifications on Telegram</p>
              </div>
              <Button onClick={handleSave} disabled={updateAgent.isPending} className="w-full">
                <Save className="w-4 h-4 mr-2" /> Save Changes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
