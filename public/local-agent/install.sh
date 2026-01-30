#!/bin/bash
# ============================================================
# TG400 SMS Gateway Agent - Ubuntu Auto-Installer
# Supports: Ubuntu 20.04, 22.04, 24.04, 25.04
# ============================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default installation directory
INSTALL_DIR="/opt/tg400-agent"
SERVICE_NAME="tg400-agent"
NODE_MIN_VERSION=18

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run this script as root (use sudo)"
        exit 1
    fi
}

# Detect Ubuntu version
detect_ubuntu() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        if [ "$ID" = "ubuntu" ]; then
            log_info "Detected Ubuntu $VERSION_ID ($VERSION_CODENAME)"
            UBUNTU_VERSION="$VERSION_ID"
            UBUNTU_CODENAME="$VERSION_CODENAME"
        else
            log_warn "This script is optimized for Ubuntu but detected $ID"
            log_warn "Continuing anyway..."
        fi
    else
        log_warn "Cannot detect OS version, assuming Ubuntu"
    fi
}

# Update system packages
update_system() {
    log_info "Updating system packages..."
    apt-get update -qq
    apt-get upgrade -y -qq
    log_success "System packages updated"
}

# Install required dependencies
install_dependencies() {
    log_info "Installing required dependencies..."
    
    # Essential packages
    apt-get install -y -qq \
        curl \
        wget \
        ca-certificates \
        gnupg \
        lsb-release \
        git \
        build-essential \
        net-tools \
        iputils-ping \
        dnsutils \
        jq \
        2>/dev/null || true
    
    log_success "Dependencies installed"
}

# Install Node.js
install_nodejs() {
    log_info "Checking Node.js installation..."
    
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$NODE_VERSION" -ge "$NODE_MIN_VERSION" ]; then
            log_success "Node.js v$(node -v | cut -d'v' -f2) is already installed"
            return 0
        else
            log_warn "Node.js version too old (v$NODE_VERSION), upgrading..."
        fi
    fi
    
    log_info "Installing Node.js v20 LTS..."
    
    # Remove old nodejs if exists
    apt-get remove -y nodejs npm 2>/dev/null || true
    
    # Install NodeSource repository
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
    
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list
    
    apt-get update -qq
    apt-get install -y nodejs
    
    log_success "Node.js $(node -v) installed"
}

# Create agent directory and files
setup_agent() {
    log_info "Setting up TG400 agent in $INSTALL_DIR..."
    
    # Create directory
    mkdir -p "$INSTALL_DIR"
    cd "$INSTALL_DIR"
    
    # Initialize npm project
    cat > package.json << 'EOF'
{
  "name": "tg400-agent",
  "version": "1.0.0",
  "description": "TG400 SMS Gateway Local Polling Agent",
  "main": "agent.js",
  "scripts": {
    "start": "node agent.js",
    "test": "node agent.js --test"
  },
  "author": "NOSTEQ",
  "license": "MIT",
  "dependencies": {
    "node-fetch": "^2.7.0"
  }
}
EOF

    # Install npm dependencies
    npm install --production 2>/dev/null
    
    log_success "Agent directory configured"
}

# Create the main agent script
create_agent_script() {
    log_info "Creating agent script..."
    
    cat > "$INSTALL_DIR/agent.js" << 'AGENT_EOF'
/**
 * TG400 Local Polling Agent v2.0
 * Enhanced for Ubuntu with automatic error recovery
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Load configuration
const CONFIG_FILE = path.join(__dirname, 'config.json');
let CONFIG;

try {
    CONFIG = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
} catch (error) {
    console.error('[FATAL] Cannot load config.json. Run: sudo tg400-config');
    process.exit(1);
}

// State persistence file
const STATE_FILE = path.join(__dirname, '.agent-state.json');

class TG400Agent {
    constructor(config) {
        this.config = config;
        this.authHeader = Buffer.from(`${config.TG400_USERNAME}:${config.TG400_PASSWORD}`).toString('base64');
        this.processedIds = this.loadState();
        this.isRunning = false;
        this.consecutiveFailures = 0;
        this.maxRetries = 5;
        this.retryDelay = 5000;
    }

    loadState() {
        try {
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
            return new Set(state.processedIds || []);
        } catch {
            return new Set();
        }
    }

    saveState() {
        try {
            const state = { 
                processedIds: Array.from(this.processedIds).slice(-10000),
                lastSave: new Date().toISOString()
            };
            fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        } catch (error) {
            this.log('warn', 'Failed to save state', { error: error.message });
        }
    }

    log(level, message, data = {}) {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[34m',
            success: '\x1b[32m',
            warn: '\x1b[33m',
            error: '\x1b[31m',
        };
        const color = colors[level] || '';
        const reset = '\x1b[0m';
        console.log(`${color}[${timestamp}] [${level.toUpperCase()}]${reset} ${message}`, Object.keys(data).length ? JSON.stringify(data) : '');
    }

    async fetchWithRetry(url, options, retries = 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 15000);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeout);
                return response;
            } catch (error) {
                if (attempt === retries) throw error;
                await this.sleep(this.retryDelay * attempt);
            }
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchFromGateway(endpoint) {
        const url = `http://${this.config.TG400_IP}${endpoint}`;
        try {
            const response = await this.fetchWithRetry(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Basic ${this.authHeader}`,
                    'Content-Type': 'application/json',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch {
                return { raw: text };
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                this.log('error', `Gateway timeout: ${endpoint}`);
            } else {
                this.log('error', `Gateway request failed: ${endpoint}`, { error: error.message });
            }
            return null;
        }
    }

    async pushToSupabase(table, data) {
        const url = `${this.config.SUPABASE_URL}/rest/v1/${table}`;
        try {
            const response = await this.fetchWithRetry(url, {
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
                // Ignore duplicate key errors
                if (errorText.includes('duplicate key') || errorText.includes('23505')) {
                    return true;
                }
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            this.consecutiveFailures = 0;
            return true;
        } catch (error) {
            this.consecutiveFailures++;
            this.log('error', `Supabase push failed: ${table}`, { error: error.message });
            return false;
        }
    }

    async pollSmsFromPort(port) {
        const endpoints = [
            `/api/v1.0/sms/get?port=${port}`,
            `/api/v1.0/sms/inbox?port=${port}`,
            `/cgi-bin/api-get_sms?port=${port}`,
            `/api/sms?port=${port}`,
            `/cgi/sms_inbox.cgi?port=${port}`,
        ];

        for (const endpoint of endpoints) {
            const result = await this.fetchFromGateway(endpoint);
            if (result && (result.messages || result.sms || result.data || result.inbox)) {
                return result.messages || result.sms || result.data || result.inbox || [];
            }
        }

        return [];
    }

    async processSmsMessages(messages, port) {
        if (!Array.isArray(messages)) {
            this.log('warn', `Invalid messages format for port ${port}`, { type: typeof messages });
            return 0;
        }

        let newCount = 0;

        for (const msg of messages) {
            const externalId = msg.id || msg.message_id || `${port}-${msg.from || msg.sender}-${msg.time || msg.received_at}-${(msg.content || msg.text || '').substring(0, 20)}`;
            
            if (this.processedIds.has(externalId)) continue;

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
                this.log('success', `SMS synced`, { port, from: smsData.sender_number });
            }
        }

        if (newCount > 0) this.saveState();
        return newCount;
    }

    async updatePortStatus(port) {
        const endpoints = [
            `/api/v1.0/gsm/status?port=${port}`,
            `/api/v1.0/port/${port}/status`,
            `/cgi-bin/api-get_gsm_status?port=${port}`,
        ];

        for (const endpoint of endpoints) {
            const result = await this.fetchFromGateway(endpoint);
            if (result && !result.raw) {
                try {
                    await this.fetchWithRetry(
                        `${this.config.SUPABASE_URL}/rest/v1/sim_port_config?port_number=eq.${port}`,
                        {
                            method: 'PATCH',
                            headers: {
                                'apikey': this.config.SUPABASE_ANON_KEY,
                                'Authorization': `Bearer ${this.config.SUPABASE_ANON_KEY}`,
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                last_seen_at: new Date().toISOString(),
                                signal_strength: result.signal || result.signal_strength || null,
                                carrier: result.carrier || result.network || null,
                            }),
                        }
                    );
                } catch {}
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
            this.log('success', `Poll complete: ${totalNew} new messages synced`);
            await this.pushToSupabase('activity_logs', {
                event_type: 'sms_sync',
                message: `Synced ${totalNew} new SMS messages from TG400`,
                severity: 'success',
                metadata: { source: 'local-agent', count: totalNew },
            });
        } else {
            this.log('info', 'Poll complete: no new messages');
        }

        // Check for too many failures
        if (this.consecutiveFailures >= this.maxRetries) {
            this.log('error', 'Too many consecutive failures, check network/credentials');
            this.consecutiveFailures = 0;
        }
    }

    async testConnection() {
        this.log('info', '=== Testing Gateway Connection ===');
        
        const endpoints = [
            '/api/v1.0/system/status',
            '/api/v1.0/system/info',
            '/cgi-bin/api-get_status',
            '/api/status',
        ];

        for (const endpoint of endpoints) {
            const result = await this.fetchFromGateway(endpoint);
            if (result && !result.raw) {
                this.log('success', 'Gateway connection OK!', { endpoint });
                return true;
            }
        }

        this.log('error', 'Cannot connect to gateway at ' + this.config.TG400_IP);
        this.log('info', 'Troubleshooting tips:');
        this.log('info', '  1. Check if gateway IP is correct in config.json');
        this.log('info', '  2. Run: ping ' + this.config.TG400_IP);
        this.log('info', '  3. Check username/password are correct');
        return false;
    }

    async testSupabase() {
        this.log('info', '=== Testing Cloud Connection ===');
        
        try {
            const response = await this.fetchWithRetry(
                `${this.config.SUPABASE_URL}/rest/v1/activity_logs?limit=1`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': this.config.SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${this.config.SUPABASE_ANON_KEY}`,
                    },
                }
            );
            
            if (response.ok) {
                this.log('success', 'Cloud connection OK!');
                return true;
            }
        } catch (error) {
            this.log('error', 'Cloud connection failed', { error: error.message });
        }
        
        return false;
    }

    async start() {
        console.log('\n');
        this.log('info', '╔══════════════════════════════════════════╗');
        this.log('info', '║   TG400 SMS Gateway Agent v2.0           ║');
        this.log('info', '╚══════════════════════════════════════════╝');
        this.log('info', `Gateway: ${this.config.TG400_IP}`);
        this.log('info', `Ports: ${this.config.TG400_PORTS.join(', ')}`);
        this.log('info', `Poll interval: ${this.config.POLL_INTERVAL / 1000}s`);
        console.log('');

        // Test connections
        const gatewayOk = await this.testConnection();
        const cloudOk = await this.testSupabase();

        if (!gatewayOk) {
            this.log('warn', 'Gateway unreachable, will keep retrying...');
        }

        if (!cloudOk) {
            this.log('error', 'Cloud connection failed! Check internet access.');
        }

        // Log agent start
        await this.pushToSupabase('activity_logs', {
            event_type: 'agent_start',
            message: 'Local polling agent started',
            severity: gatewayOk ? 'success' : 'warning',
            metadata: { 
                source: 'local-agent', 
                gateway_ip: this.config.TG400_IP,
                gateway_connected: gatewayOk 
            },
        });

        this.isRunning = true;
        await this.pollAllPorts();

        setInterval(async () => {
            if (this.isRunning) {
                await this.pollAllPorts();
            }
        }, this.config.POLL_INTERVAL);

        this.log('info', 'Agent running. Press Ctrl+C to stop.');
    }

    stop() {
        this.log('info', 'Shutting down agent...');
        this.saveState();
        this.isRunning = false;
    }
}

// Check for test mode
if (process.argv.includes('--test')) {
    const agent = new TG400Agent(CONFIG);
    Promise.all([agent.testConnection(), agent.testSupabase()]).then(([gw, cloud]) => {
        console.log('\n=== Test Results ===');
        console.log(`Gateway: ${gw ? 'OK' : 'FAILED'}`);
        console.log(`Cloud: ${cloud ? 'OK' : 'FAILED'}`);
        process.exit(gw && cloud ? 0 : 1);
    });
} else {
    const agent = new TG400Agent(CONFIG);
    agent.start();

    process.on('SIGINT', () => { agent.stop(); process.exit(0); });
    process.on('SIGTERM', () => { agent.stop(); process.exit(0); });
}
AGENT_EOF

    log_success "Agent script created"
}

# Create configuration wizard
create_config_wizard() {
    log_info "Creating configuration wizard..."
    
    cat > "/usr/local/bin/tg400-config" << 'CONFIG_EOF'
#!/bin/bash
# TG400 Agent Configuration Wizard

CONFIG_FILE="/opt/tg400-agent/config.json"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════════╗"
echo "║     TG400 SMS Gateway - Configuration Wizard      ║"
echo "╚═══════════════════════════════════════════════════╝"
echo -e "${NC}"

# Load existing config if available
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Existing configuration found. Press Enter to keep current values.${NC}\n"
    EXISTING=$(cat "$CONFIG_FILE")
    CURRENT_IP=$(echo "$EXISTING" | grep -oP '"TG400_IP":\s*"\K[^"]+' || echo "192.168.5.3")
    CURRENT_USER=$(echo "$EXISTING" | grep -oP '"TG400_USERNAME":\s*"\K[^"]+' || echo "admin")
    CURRENT_PASS=$(echo "$EXISTING" | grep -oP '"TG400_PASSWORD":\s*"\K[^"]+' || echo "")
    CURRENT_PORTS=$(echo "$EXISTING" | grep -oP '"TG400_PORTS":\s*\[\K[^\]]+' || echo "1, 2, 3, 4")
    CURRENT_INTERVAL=$(echo "$EXISTING" | grep -oP '"POLL_INTERVAL":\s*\K[0-9]+' || echo "30000")
else
    CURRENT_IP="192.168.5.3"
    CURRENT_USER="admin"
    CURRENT_PASS=""
    CURRENT_PORTS="1, 2, 3, 4"
    CURRENT_INTERVAL="30000"
fi

# TG400 Settings
echo -e "${GREEN}=== TG400 Gateway Settings ===${NC}"
read -p "Gateway IP [$CURRENT_IP]: " TG400_IP
TG400_IP=${TG400_IP:-$CURRENT_IP}

read -p "Username [$CURRENT_USER]: " TG400_USERNAME
TG400_USERNAME=${TG400_USERNAME:-$CURRENT_USER}

read -sp "Password [hidden]: " TG400_PASSWORD
echo ""
TG400_PASSWORD=${TG400_PASSWORD:-$CURRENT_PASS}

read -p "SIM Ports (comma-separated) [$CURRENT_PORTS]: " PORTS_INPUT
PORTS_INPUT=${PORTS_INPUT:-$CURRENT_PORTS}
# Convert to JSON array format
TG400_PORTS=$(echo "$PORTS_INPUT" | sed 's/[^0-9,]//g' | sed 's/,/, /g')

read -p "Poll interval in seconds [$(($CURRENT_INTERVAL/1000))]: " POLL_SEC
POLL_SEC=${POLL_SEC:-$(($CURRENT_INTERVAL/1000))}
POLL_INTERVAL=$((POLL_SEC * 1000))

# Supabase settings (pre-configured)
SUPABASE_URL="https://aougsyziktukjvkmglzb.supabase.co"
SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvdWdzeXppa3R1a2p2a21nbHpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkzNDg5NTYsImV4cCI6MjA4NDkyNDk1Nn0.dcsZwEJXND9xdNA1dR-uHH7r6WylGwL7xVKJSFL_C44"

# Create config file
cat > "$CONFIG_FILE" << EOF
{
  "TG400_IP": "$TG400_IP",
  "TG400_USERNAME": "$TG400_USERNAME",
  "TG400_PASSWORD": "$TG400_PASSWORD",
  "TG400_PORTS": [$TG400_PORTS],
  "SUPABASE_URL": "$SUPABASE_URL",
  "SUPABASE_ANON_KEY": "$SUPABASE_ANON_KEY",
  "POLL_INTERVAL": $POLL_INTERVAL
}
EOF

chmod 600 "$CONFIG_FILE"

echo ""
echo -e "${GREEN}Configuration saved to $CONFIG_FILE${NC}"
echo ""
echo -e "${YELLOW}Testing connection...${NC}"
cd /opt/tg400-agent && node agent.js --test

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Start the agent with: sudo systemctl start tg400-agent"
    echo "View logs with: sudo journalctl -u tg400-agent -f"
else
    echo ""
    echo -e "${RED}✗ Connection test failed. Please check your settings.${NC}"
    echo "Run 'sudo tg400-config' to reconfigure."
fi
CONFIG_EOF

    chmod +x /usr/local/bin/tg400-config
    log_success "Configuration wizard created"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=TG400 SMS Gateway Polling Agent
After=network-online.target
Wants=network-online.target
StartLimitIntervalSec=60
StartLimitBurst=3

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/node $INSTALL_DIR/agent.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=tg400-agent

# Hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$INSTALL_DIR
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    log_success "Systemd service created and enabled"
}

# Create helper commands
create_helper_commands() {
    log_info "Creating helper commands..."
    
    # Status command
    cat > /usr/local/bin/tg400-status << 'EOF'
#!/bin/bash
echo "=== TG400 Agent Status ==="
systemctl status tg400-agent --no-pager
echo ""
echo "=== Recent Logs ==="
journalctl -u tg400-agent -n 20 --no-pager
EOF
    chmod +x /usr/local/bin/tg400-status
    
    # Logs command
    cat > /usr/local/bin/tg400-logs << 'EOF'
#!/bin/bash
journalctl -u tg400-agent -f
EOF
    chmod +x /usr/local/bin/tg400-logs
    
    # Restart command
    cat > /usr/local/bin/tg400-restart << 'EOF'
#!/bin/bash
sudo systemctl restart tg400-agent
echo "TG400 Agent restarted"
sudo journalctl -u tg400-agent -n 10 --no-pager
EOF
    chmod +x /usr/local/bin/tg400-restart
    
    # Test command
    cat > /usr/local/bin/tg400-test << 'EOF'
#!/bin/bash
cd /opt/tg400-agent && node agent.js --test
EOF
    chmod +x /usr/local/bin/tg400-test
    
    log_success "Helper commands created"
}

# Print completion message
print_completion() {
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║           Installation Complete!                          ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo "  1. Run configuration wizard:  ${YELLOW}sudo tg400-config${NC}"
    echo "  2. Start the agent:           ${YELLOW}sudo systemctl start tg400-agent${NC}"
    echo "  3. Check status:              ${YELLOW}tg400-status${NC}"
    echo ""
    echo -e "${BLUE}Available Commands:${NC}"
    echo "  ${YELLOW}tg400-config${NC}   - Configure gateway settings"
    echo "  ${YELLOW}tg400-status${NC}   - Show agent status and recent logs"
    echo "  ${YELLOW}tg400-logs${NC}     - Follow live logs"
    echo "  ${YELLOW}tg400-restart${NC}  - Restart the agent"
    echo "  ${YELLOW}tg400-test${NC}     - Test gateway connection"
    echo ""
    echo -e "${BLUE}Installation Directory:${NC} $INSTALL_DIR"
    echo -e "${BLUE}Configuration File:${NC} $INSTALL_DIR/config.json"
    echo ""
}

# Main installation
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║     TG400 SMS Gateway Agent - Ubuntu Installer            ║${NC}"
    echo -e "${BLUE}║     Version 2.0                                           ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    detect_ubuntu
    update_system
    install_dependencies
    install_nodejs
    setup_agent
    create_agent_script
    create_config_wizard
    create_systemd_service
    create_helper_commands
    print_completion
}

main "$@"
