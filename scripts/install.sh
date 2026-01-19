#!/bin/bash
#
# Airdrop Supervisor - Server Installation Script
# Tested on: Ubuntu 22.04 / Debian 12
#
# Usage:
#   chmod +x scripts/install.sh
#   sudo ./scripts/install.sh
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if running as root
check_root() {
  if [[ $EUID -ne 0 ]]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
  fi
}

# Detect OS
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VERSION=$VERSION_ID
  else
    log_error "Cannot detect OS. This script supports Ubuntu/Debian."
    exit 1
  fi
  log_info "Detected OS: $OS $VERSION"
}

# Install Docker
install_docker() {
  if command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
    return
  fi

  log_info "Installing Docker..."
  
  # Install dependencies
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release

  # Add Docker GPG key (handle existing key gracefully)
  install -m 0755 -d /etc/apt/keyrings
  if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/$OS/gpg | gpg --batch --yes --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
  else
    log_info "Docker GPG key already exists, skipping"
  fi

  # Add Docker repository (only if not already added)
  if [ ! -f /etc/apt/sources.list.d/docker.list ]; then
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/$OS \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
  fi

  # Install Docker
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  # Start and enable Docker
  systemctl start docker
  systemctl enable docker

  log_info "Docker installed successfully"
}

# Install Node.js (for running tests)
install_nodejs() {
  if command -v node &> /dev/null; then
    log_info "Node.js already installed: $(node --version)"
    return
  fi

  log_info "Installing Node.js 20.x..."
  
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs

  log_info "Node.js installed: $(node --version)"
}

# Install Nginx (for serving frontend)
install_nginx() {
  if command -v nginx &> /dev/null; then
    log_info "Nginx already installed"
    return
  fi

  log_info "Installing Nginx..."
  apt-get install -y nginx
  systemctl enable nginx
  log_info "Nginx installed"
}

# Create environment file
create_env_file() {
  local ENV_FILE="$PROJECT_DIR/.env"
  
  if [ -f "$ENV_FILE" ]; then
    log_warn ".env file already exists, skipping creation"
    return
  fi

  log_info "Creating .env file..."
  
  # Generate encryption key
  N8N_KEY=$(openssl rand -hex 16)
  
  cat > "$ENV_FILE" << EOF
# n8n Configuration
N8N_ENCRYPTION_KEY=$N8N_KEY
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
WEBHOOK_URL=http://localhost:5678/

# RSS Feed URL (Airdrops.io)
RSS_FEED_URL=https://airdrops.io/feed/

# Supabase Configuration (REQUIRED - fill these in!)
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Frontend port
FRONTEND_PORT=8080
EOF

  chmod 600 "$ENV_FILE"
  log_info ".env file created at $ENV_FILE"
  log_warn "Please edit .env and add your Supabase credentials!"
}

# Configure Nginx for frontend
configure_nginx() {
  local NGINX_CONF="/etc/nginx/sites-available/airdrop-supervisor"
  
  log_info "Configuring Nginx..."
  
  cat > "$NGINX_CONF" << EOF
server {
    listen 80;
    server_name _;
    
    # Frontend static files
    location / {
        root $PROJECT_DIR/web;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
    
    # n8n proxy (optional, for webhook access)
    location /n8n/ {
        proxy_pass http://localhost:5678/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  # Enable site
  ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/
  rm -f /etc/nginx/sites-enabled/default
  
  # Test and reload
  nginx -t
  systemctl reload nginx
  
  log_info "Nginx configured"
}

# Create systemd service for n8n
create_n8n_service() {
  local SERVICE_FILE="/etc/systemd/system/airdrop-n8n.service"
  
  log_info "Creating n8n systemd service..."
  
  cat > "$SERVICE_FILE" << EOF
[Unit]
Description=Airdrop Supervisor n8n
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=$PROJECT_DIR
EnvironmentFile=$PROJECT_DIR/.env
ExecStart=/usr/bin/docker compose up
ExecStop=/usr/bin/docker compose down
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  log_info "n8n service created (airdrop-n8n.service)"
}

# Run tests
run_tests() {
  log_info "Running tests..."
  cd "$PROJECT_DIR"
  npm -C n8n/functions install --silent 2>/dev/null || true
  npm -C n8n/functions test
  log_info "Tests passed"
}

# Print final instructions
print_instructions() {
  local SERVER_IP=$(hostname -I | awk '{print $1}')
  
  echo ""
  echo "=============================================="
  echo -e "${GREEN}Installation Complete!${NC}"
  echo "=============================================="
  echo ""
  echo "Next steps:"
  echo ""
  echo "1. Edit the .env file with your Supabase credentials:"
  echo "   nano $PROJECT_DIR/.env"
  echo ""
  echo "2. Update frontend config with Supabase URL:"
  echo "   nano $PROJECT_DIR/web/app.js"
  echo ""
  echo "3. Apply Supabase database migration:"
  echo "   (Run in Supabase SQL Editor)"
  echo "   $PROJECT_DIR/supabase/migrations/0001_create_airdrops.sql"
  echo ""
  echo "4. Start n8n service:"
  echo "   sudo systemctl start airdrop-n8n"
  echo "   sudo systemctl enable airdrop-n8n"
  echo ""
  echo "5. Access the services:"
  echo "   - Frontend: http://$SERVER_IP/"
  echo "   - n8n UI:   http://$SERVER_IP:5678/"
  echo ""
  echo "6. Import workflow in n8n UI:"
  echo "   File → Import → $PROJECT_DIR/n8n/workflows/ingest-rss-airdrops.json"
  echo ""
  echo "=============================================="
}

# Main installation flow
main() {
  check_root
  detect_os
  
  # Get project directory (parent of scripts/)
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
  
  log_info "Project directory: $PROJECT_DIR"
  
  # Install dependencies
  apt-get update
  apt-get install -y curl wget git openssl
  
  install_docker
  install_nodejs
  install_nginx
  
  # Configure project
  create_env_file
  configure_nginx
  create_n8n_service
  
  # Run tests
  run_tests
  
  # Print instructions
  print_instructions
}

main "$@"
