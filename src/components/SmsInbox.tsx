import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Clock } from "lucide-react";

interface SmsMessage {
  id: string;
  sender: string;
  simPort: number;
  content: string;
  timestamp: string;
  isNew: boolean;
}

interface SmsInboxProps {
  messages: SmsMessage[];
}

export const SmsInbox = ({ messages }: SmsInboxProps) => {
  return (
    <Card className="card-glow border-border/50 bg-card h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <CardTitle className="text-base font-semibold">SMS Inbox</CardTitle>
          </div>
          <Badge variant="secondary" className="font-mono">
            {messages.length} messages
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          <div className="divide-y divide-border/50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`p-4 hover:bg-muted/30 transition-colors ${
                  message.isNew ? "border-l-2 border-l-primary" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium text-foreground">
                      {message.sender}
                    </span>
                    <Badge 
                      variant="outline" 
                      className="text-xs font-mono border-primary/30 text-primary"
                    >
                      SIM {message.simPort}
                    </Badge>
                    {message.isNew && (
                      <Badge className="text-xs bg-primary/20 text-primary border-0">
                        New
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span className="font-mono">{message.timestamp}</span>
                  </div>
                </div>
                <p className="text-sm text-secondary-foreground leading-relaxed">
                  {message.content}
                </p>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
