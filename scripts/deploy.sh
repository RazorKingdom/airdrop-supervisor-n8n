#!/bin/bash
#
# Airdrop Supervisor - Ubuntu One-Click Deployment Script
# 
# This script installs and configures:
# - Docker & Docker Compose
# - PostgreSQL (database)
# - PostgREST (auto REST API)
# - n8n (workflow automation)
# - Nginx (reverse proxy)
#
# Usage: sudo ./scripts/deploy.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="${INSTALL_DIR:-/opt/airdrop-supervisor}"
NGINX_CONF="/etc/nginx/sites-available/airdrop-supervisor"
SYSTEMD_SERVICE="/etc/systemd/system/airdrop-supervisor.service"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root. Use: sudo $0"
    fi
}

# Detect OS
detect_os() {
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        OS=$ID
        VERSION=$VERSION_ID
    else
        log_error "Cannot detect OS. This script requires Ubuntu/Debian."
    fi
    
    if [[ "$OS" != "ubuntu" && "$OS" != "debian" ]]; then
        log_error "This script only supports Ubuntu/Debian. Detected: $OS"
    fi
    
    log_info "Detected OS: $OS $VERSION"
}

# Install Docker
install_docker() {
    if command -v docker &> /dev/null; then
        log_info "Docker already installed: $(docker --version)"
        return 0
    fi
    
    log_info "Installing Docker..."
    
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release
    
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    if [[ ! -f /etc/apt/keyrings/docker.gpg ]]; then
        curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    fi
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed successfully"
}

# Install Nginx
install_nginx() {
    if command -v nginx &> /dev/null; then
        log_info "Nginx already installed"
        return 0
    fi
    
    log_info "Installing Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    log_success "Nginx installed successfully"
}

# Setup project directory
setup_project() {
    log_info "Setting up project directory at $INSTALL_DIR..."
    
    # If running from git repo, use current directory
    SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
    
    if [[ "$PROJECT_DIR" != "$INSTALL_DIR" ]]; then
        if [[ -d "$INSTALL_DIR" ]]; then
            log_warn "Directory $INSTALL_DIR already exists, updating..."
            cp -r "$PROJECT_DIR"/* "$INSTALL_DIR/"
        else
            cp -r "$PROJECT_DIR" "$INSTALL_DIR"
        fi
    fi
    
    cd "$INSTALL_DIR"
    log_success "Project directory ready"
}

# Generate secure passwords
generate_secrets() {
    log_info "Generating secure credentials..."
    
    ENV_FILE="$INSTALL_DIR/.env"
    
    if [[ -f "$ENV_FILE" ]]; then
        log_warn ".env file already exists, skipping generation"
        return 0
    fi
    
    POSTGRES_PASSWORD=$(openssl rand -base64 24 | tr -dc 'a-zA-Z0-9' | head -c 32)
    N8N_PASSWORD=$(openssl rand -base64 16 | tr -dc 'a-zA-Z0-9' | head -c 16)
    N8N_ENCRYPTION_KEY=$(openssl rand -hex 32)
    
    cat > "$ENV_FILE" << EOF
# Airdrop Supervisor Configuration
# Generated on $(date)

# PostgreSQL
POSTGRES_USER=airdrop
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
POSTGRES_DB=airdrops

# n8n
N8N_USER=admin
N8N_PASSWORD=$N8N_PASSWORD
N8N_ENCRYPTION_KEY=$N8N_ENCRYPTION_KEY

# RSS Feed URL (change to your preferred source)
RSS_FEED_URL=https://airdrops.io/feed/

# Server settings
DOMAIN=localhost
EOF

    chmod 600 "$ENV_FILE"
    log_success "Credentials generated and saved to .env"
    
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo -e "${YELLOW}  IMPORTANT: Save these credentials!    ${NC}"
    echo -e "${YELLOW}========================================${NC}"
    echo ""
    echo -e "  n8n Login:     ${GREEN}admin${NC} / ${GREEN}$N8N_PASSWORD${NC}"
    echo -e "  PostgreSQL:    ${GREEN}airdrop${NC} / ${GREEN}$POSTGRES_PASSWORD${NC}"
    echo ""
    echo -e "${YELLOW}========================================${NC}"
    echo ""
}

# Start Docker services
start_services() {
    log_info "Starting Docker services..."
    
    cd "$INSTALL_DIR"
    
    # Pull images first
    docker compose -f docker-compose.local.yml pull
    
    # Start services
    docker compose -f docker-compose.local.yml up -d
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Check if services are running
    if docker compose -f docker-compose.local.yml ps | grep -q "running"; then
        log_success "All services started"
    else
        log_error "Some services failed to start. Check: docker compose -f docker-compose.local.yml logs"
    fi
}

# Configure Nginx
configure_nginx() {
    log_info "Configuring Nginx..."
    
    # Create Nginx config
    cat > "$NGINX_CONF" << 'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    
    server_name _;
    
    # Frontend static files
    root /opt/airdrop-supervisor/web;
    index index.html;
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
    
    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # PostgREST API
    location /api/ {
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PATCH, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Prefer" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }
    
    # n8n WebUI (optional - can also access via :5678)
    location /n8n/ {
        proxy_pass http://127.0.0.1:5678/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    
    # Health check
    location /health {
        return 200 'OK';
        add_header Content-Type text/plain;
    }
}
EOF

    # Enable site
    ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/airdrop-supervisor
    
    # Disable default site if exists
    rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true
    
    # Test and reload Nginx
    nginx -t && systemctl reload nginx
    
    log_success "Nginx configured"
}

# Create systemd service
create_systemd_service() {
    log_info "Creating systemd service..."
    
    cat > "$SYSTEMD_SERVICE" << EOF
[Unit]
Description=Airdrop Supervisor (Docker Compose)
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/docker compose -f docker-compose.local.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.local.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable airdrop-supervisor
    
    log_success "Systemd service created"
}

# Update frontend config for local API
update_frontend_config() {
    log_info "Updating frontend configuration..."
    
    APP_JS="$INSTALL_DIR/web/app.js"
    
    # Check if already configured for local
    if grep -q "SUPABASE_URL: '/api'" "$APP_JS" 2>/dev/null; then
        log_info "Frontend already configured for local API"
        return 0
    fi
    
    # Update SUPABASE_URL to use local API
    sed -i "s|SUPABASE_URL: ''|SUPABASE_URL: '/api'|g" "$APP_JS"
    sed -i "s|SUPABASE_ANON_KEY: ''|SUPABASE_ANON_KEY: 'local'|g" "$APP_JS"
    
    log_success "Frontend configured to use local API"
}

# Print summary
print_summary() {
    # Get server IP
    SERVER_IP=$(hostname -I | awk '{print $1}')
    
    echo ""
    echo -e "${GREEN}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║          AIRDROP SUPERVISOR DEPLOYMENT COMPLETE!          ║${NC}"
    echo -e "${GREEN}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "  ${BLUE}Frontend:${NC}   http://$SERVER_IP/"
    echo -e "  ${BLUE}n8n:${NC}        http://$SERVER_IP:5678/"
    echo -e "  ${BLUE}API:${NC}        http://$SERVER_IP/api/airdrops"
    echo ""
    echo -e "  ${YELLOW}Next Steps:${NC}"
    echo -e "  1. Access n8n at http://$SERVER_IP:5678/"
    echo -e "  2. Login with credentials shown above"
    echo -e "  3. Import workflow: n8n/workflows/ingest-rss-airdrops.json"
    echo -e "  4. Activate the workflow"
    echo ""
    echo -e "  ${YELLOW}Useful Commands:${NC}"
    echo -e "  • View logs:    docker compose -f docker-compose.local.yml logs -f"
    echo -e "  • Restart:      sudo systemctl restart airdrop-supervisor"
    echo -e "  • Stop:         docker compose -f docker-compose.local.yml down"
    echo ""
}

# Main installation flow
main() {
    echo ""
    echo -e "${BLUE}╔═══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║        AIRDROP SUPERVISOR - ONE-CLICK DEPLOYMENT          ║${NC}"
    echo -e "${BLUE}╚═══════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    check_root
    detect_os
    install_docker
    install_nginx
    setup_project
    generate_secrets
    update_frontend_config
    start_services
    configure_nginx
    create_systemd_service
    print_summary
}

# Run main function
main "$@"
