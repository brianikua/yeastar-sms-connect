import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Server, Copy, Check, Download, Terminal } from "lucide-react";
import { toast } from "sonner";

export const LocalAgentGuide = () => {
  const [copied, setCopied] = useState(false);

  const copyCommand = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadAgent = () => {
    window.open("/local-agent/tg400-agent.js", "_blank");
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Server className="h-4 w-4" />
          Local Agent Setup
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            Local Polling Agent Setup
          </DialogTitle>
          <DialogDescription>
            Run this agent on a machine in your local network to sync SMS from the TG400.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="h-[500px] pr-4">
          <div className="space-y-6">
            {/* Why needed */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge variant="outline">Why?</Badge>
              </h3>
              <p className="text-sm text-muted-foreground">
                Your TG400 gateway is on a private network (192.168.x.x) that cloud services cannot reach. 
                This agent runs locally and bridges the gap by polling your gateway and syncing data to the cloud.
              </p>
            </section>

            {/* Requirements */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge variant="outline">Requirements</Badge>
              </h3>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>A computer on the same network as the TG400 (always on)</li>
                <li>Node.js installed (v16 or higher)</li>
                <li>Network access to both the TG400 and the internet</li>
              </ul>
            </section>

            {/* Step 1 */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge>Step 1</Badge>
                Download the Agent
              </h3>
              <Button onClick={downloadAgent} variant="secondary" size="sm" className="gap-2">
                <Download className="h-4 w-4" />
                Download tg400-agent.js
              </Button>
            </section>

            {/* Step 2 */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge>Step 2</Badge>
                Configure the Agent
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                Open the file and update the CONFIG section at the top:
              </p>
              <div className="relative">
                <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto font-mono">
{`const CONFIG = {
  TG400_IP: '192.168.5.3',      // Your gateway IP
  TG400_USERNAME: 'admin',       // API username
  TG400_PASSWORD: 'your-pass',   // API password
  TG400_PORTS: [1, 2, 3, 4],    // Active SIM ports
  // ... Supabase settings are pre-configured
};`}
                </pre>
              </div>
            </section>

            {/* Step 3 */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge>Step 3</Badge>
                Install & Run
              </h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded-md font-mono">
                    npm init -y && npm install node-fetch
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyCommand("npm init -y && npm install node-fetch")}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted p-2 rounded-md font-mono">
                    node tg400-agent.js
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyCommand("node tg400-agent.js")}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </section>

            {/* Step 4 - PM2 */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge variant="secondary">Optional</Badge>
                Run as Service with PM2
              </h3>
              <p className="text-sm text-muted-foreground mb-2">
                For automatic startup and always-on operation:
              </p>
              <div className="space-y-2">
                <code className="block text-xs bg-muted p-2 rounded-md font-mono">
                  npm install -g pm2
                </code>
                <code className="block text-xs bg-muted p-2 rounded-md font-mono">
                  pm2 start tg400-agent.js --name "tg400-agent"
                </code>
                <code className="block text-xs bg-muted p-2 rounded-md font-mono">
                  pm2 save && pm2 startup
                </code>
              </div>
            </section>

            {/* Troubleshooting */}
            <section>
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                <Badge variant="destructive">Troubleshooting</Badge>
              </h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>
                  <strong>Connection timeout:</strong> Check the TG400 IP and ensure the machine can ping it
                </li>
                <li>
                  <strong>Auth failed:</strong> Verify username/password match your TG400 web interface credentials
                </li>
                <li>
                  <strong>No messages synced:</strong> The agent tries multiple API endpoints; check your TG400 firmware version
                </li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
