/**
 * TG400 Local Polling Agent
 * 
 * Run this script on a machine within your local network that can reach
 * both the TG400 gateway and the internet (for Supabase sync).
 * 
 * Installation:
 * 1. Install Node.js on a local machine
 * 2. Copy this file to a folder
 * 3. Run: npm init -y && npm install node-fetch
 * 4. Configure the variables below
 * 5. Run: node tg400-agent.js
 * 
 * For continuous operation, use PM2:
 *   npm install -g pm2
 *   pm2 start tg400-agent.js --name "tg400-agent"
 *   pm2 save
 *   pm2 startup
 */

// ============ CONFIGURATION ============
const CONFIG = {
  // TG400 Gateway Settings (your local gateway)
  TG400_IP: '192.168.5.3',
  TG400_USERNAME: 'admin',
  TG400_PASSWORD: 'your-password',
  TG400_PORTS: [1, 2, 3, 4], // SIM ports to poll
  
  // Supabase Settings (from your Lovable project)
  SUPABASE_URL: 'https://aougsyziktukjvkmglzb.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWdzeXppa3R1a2p2a21nbHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDg5NTYsImV4cCI6MjA4NDkyNDk1Nn0.dcsZwEJXND9xdNA1dR-uHH7r6WylGwL7xVKJSFL_C44',
  
  // Polling interval in milliseconds (30 seconds)
  POLL_INTERVAL: 30000,
};
// ========================================

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

class TG400Agent {
  constructor(config) {
    this.config = config;
    this.authHeader = Buffer.from(`${config.TG400_USERNAME}:${config.TG400_PASSWORD}`).toString('base64');
    this.processedIds = new Set();
    this.isRunning = false;
  }

  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, level, message, ...data };
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, Object.keys(data).length ? JSON.stringify(data) : '');
  }

  async fetchFromGateway(endpoint) {
    const url = `http://${this.config.TG400_IP}${endpoint}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${this.authHeader}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      this.log('error', `Gateway request failed: ${endpoint}`, { error: error.message });
      return null;
    }
  }

  async pushToSupabase(table, data) {
    const url = `${this.config.SUPABASE_URL}/rest/v1/${table}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'apikey': this.config.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${this.config.SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return true;
    } catch (error) {
      this.log('error', `Supabase push failed: ${table}`, { error: error.message });
      return false;
    }
  }

  async pollSmsFromPort(port) {
    // Try different API endpoints (Yeastar API varies by firmware version)
    const endpoints = [
      `/api/v1.0/sms/get?port=${port}`,
      `/cgi-bin/api-get_sms?port=${port}`,
      `/api/sms?port=${port}`,
    ];

    for (const endpoint of endpoints) {
      const result = await this.fetchFromGateway(endpoint);
      if (result && (result.messages || result.sms || result.data)) {
        return result.messages || result.sms || result.data || [];
      }
    }

    return [];
  }

  async processSmsMessages(messages, port) {
    let newCount = 0;

    for (const msg of messages) {
      // Create a unique ID for deduplication
      const externalId = msg.id || msg.message_id || `${port}-${msg.from || msg.sender}-${msg.time || msg.received_at}-${(msg.content || msg.text || '').substring(0, 20)}`;
      
      if (this.processedIds.has(externalId)) {
        continue;
      }

      const smsData = {
        external_id: externalId,
        sim_port: port,
        sender_number: msg.from || msg.sender || msg.number || 'Unknown',
        message_content: msg.content || msg.text || msg.message || '',
        received_at: msg.time || msg.received_at || new Date().toISOString(),
        status: 'unread',
      };

      const success = await this.pushToSupabase('sms_messages', smsData);
      
      if (success) {
        this.processedIds.add(externalId);
        newCount++;
        this.log('info', `New SMS synced`, { port, from: smsData.sender_number });
      }
    }

    return newCount;
  }

  async updatePortStatus(port) {
    // Try to get SIM status
    const endpoints = [
      `/api/v1.0/gsm/status?port=${port}`,
      `/cgi-bin/api-get_gsm_status?port=${port}`,
    ];

    for (const endpoint of endpoints) {
      const result = await this.fetchFromGateway(endpoint);
      if (result) {
        const portData = {
          last_seen_at: new Date().toISOString(),
          signal_strength: result.signal || result.signal_strength || null,
          carrier: result.carrier || result.network || null,
        };

        await fetch(`${this.config.SUPABASE_URL}/rest/v1/sim_port_config?port_number=eq.${port}`, {
          method: 'PATCH',
          headers: {
            'apikey': this.config.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${this.config.SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(portData),
        });
        break;
      }
    }
  }

  async pollAllPorts() {
    this.log('info', 'Starting poll cycle...');
    let totalNew = 0;

    for (const port of this.config.TG400_PORTS) {
      try {
        const messages = await this.pollSmsFromPort(port);
        const newCount = await this.processSmsMessages(messages, port);
        totalNew += newCount;
        
        await this.updatePortStatus(port);
      } catch (error) {
        this.log('error', `Error polling port ${port}`, { error: error.message });
      }
    }

    if (totalNew > 0) {
      this.log('info', `Poll complete: ${totalNew} new messages synced`);
      
      // Log activity
      await this.pushToSupabase('activity_logs', {
        event_type: 'sms_sync',
        message: `Synced ${totalNew} new SMS messages from TG400`,
        severity: 'success',
        metadata: { source: 'local-agent', count: totalNew },
      });
    }
  }

  async testConnection() {
    this.log('info', 'Testing gateway connection...');
    
    const testEndpoints = [
      '/api/v1.0/system/status',
      '/cgi-bin/api-get_status',
      '/api/status',
    ];

    for (const endpoint of testEndpoints) {
      const result = await this.fetchFromGateway(endpoint);
      if (result) {
        this.log('info', 'Gateway connection successful!', { endpoint });
        
        await this.pushToSupabase('activity_logs', {
          event_type: 'connection_test',
          message: 'Local agent connected to TG400 successfully',
          severity: 'success',
          metadata: { source: 'local-agent', gateway_ip: this.config.TG400_IP },
        });
        
        return true;
      }
    }

    this.log('error', 'Could not connect to gateway');
    return false;
  }

  async start() {
    this.log('info', '=== TG400 Local Polling Agent Starting ===');
    this.log('info', `Gateway: ${this.config.TG400_IP}`);
    this.log('info', `Polling interval: ${this.config.POLL_INTERVAL}ms`);
    this.log('info', `Ports: ${this.config.TG400_PORTS.join(', ')}`);

    // Test connection first
    const connected = await this.testConnection();
    if (!connected) {
      this.log('warn', 'Initial connection failed, will retry on next poll');
    }

    this.isRunning = true;

    // Initial poll
    await this.pollAllPorts();

    // Start polling loop
    setInterval(async () => {
      if (this.isRunning) {
        await this.pollAllPorts();
      }
    }, this.config.POLL_INTERVAL);

    this.log('info', 'Agent running. Press Ctrl+C to stop.');
  }

  stop() {
    this.log('info', 'Stopping agent...');
    this.isRunning = false;
  }
}

// Start the agent
const agent = new TG400Agent(CONFIG);
agent.start();

// Handle graceful shutdown
process.on('SIGINT', () => {
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  agent.stop();
  process.exit(0);
});
