#!/bin/bash

# EventHub Backend - Automated Ubuntu Deployment Script
# Version: 2.0
# This script automates the deployment of EventHub microservices on Ubuntu

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/home/user1/personal/providers_hub"
DOMAIN="providerapi.erb.go.ug"  # Change this to your domain or use IP
LOG_DIR="$APP_DIR/logs"
NODE_VERSION="20"

# Banner
print_banner() {
    echo -e "${CYAN}"
    echo "╔═══════════════════════════════════════════════════════╗"
    echo "║                                                       ║"
    echo "║          EventHub Backend Deployment v2.0            ║"
    echo "║              Ubuntu 20.04/22.04 LTS                  ║"
    echo "║                                                       ║"
    echo "╚═══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

print_section() {
    echo ""
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════${NC}"
    echo -e "${MAGENTA}  $1${NC}"
    echo -e "${MAGENTA}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
       print_error "This script must be run as root (use sudo)"
       echo "Usage: sudo bash deploy.sh"
       exit 1
    fi
}

check_ubuntu() {
    if [ ! -f /etc/os-release ]; then
        print_error "Cannot detect OS version"
        exit 1
    fi
    
    . /etc/os-release
    if [[ "$ID" != "ubuntu" ]]; then
        print_error "This script is designed for Ubuntu. Detected: $ID"
        exit 1
    fi
    
    print_status "Detected Ubuntu $VERSION_ID"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

install_dependencies() {
    print_section "Installing System Dependencies"
    
    print_info "Updating package lists..."
    apt update -qq
    
    print_info "Installing essential packages..."
    apt install -y curl git build-essential software-properties-common \
        apt-transport-https ca-certificates gnupg lsb-release \
        ufw fail2ban htop net-tools > /dev/null 2>&1
    
    print_status "System dependencies installed"
}

install_node() {
    print_section "Installing Node.js $NODE_VERSION"
    
    if command_exists node; then
        CURRENT_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$CURRENT_VERSION" -ge "$NODE_VERSION" ]; then
            print_status "Node.js $(node -v) already installed"
            return
        fi
    fi
    
    print_info "Adding NodeSource repository..."
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - > /dev/null 2>&1
    
    print_info "Installing Node.js..."
    apt install -y nodejs > /dev/null 2>&1
    
    print_status "Node.js installed: $(node --version)"
    print_status "npm installed: $(npm --version)"
}

install_docker() {
    print_section "Installing Docker"
    
    if command_exists docker; then
        print_status "Docker already installed: $(docker --version)"
        return
    fi
    
    print_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh > /dev/null 2>&1
    rm get-docker.sh
    
    # Add current user to docker group
    if [ -n "$SUDO_USER" ]; then
        usermod -aG docker $SUDO_USER
        print_status "Added $SUDO_USER to docker group"
    fi
    
    # Start and enable Docker
    systemctl start docker
    systemctl enable docker > /dev/null 2>&1
    
    print_status "Docker installed: $(docker --version)"
}

install_docker_compose() {
    print_section "Installing Docker Compose"
    
    if command_exists docker-compose; then
        print_status "Docker Compose already installed: $(docker-compose --version)"
        return
    fi
    
    print_info "Downloading Docker Compose..."
    COMPOSE_VERSION="2.24.0"
    curl -L "https://github.com/docker/compose/releases/download/v${COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" \
        -o /usr/local/bin/docker-compose > /dev/null 2>&1
    
    chmod +x /usr/local/bin/docker-compose
    
    print_status "Docker Compose installed: $(docker-compose --version)"
}

install_pm2() {
    print_section "Installing PM2 Process Manager"
    
    if command_exists pm2; then
        print_status "PM2 already installed: $(pm2 --version)"
        return
    fi
    
    print_info "Installing PM2 globally..."
    npm install -g pm2 > /dev/null 2>&1
    
    print_status "PM2 installed: v$(pm2 --version)"
}

install_nginx() {
    print_section "Installing Nginx"
    
    if command_exists nginx; then
        print_status "Nginx already installed: $(nginx -v 2>&1)"
        return
    fi
    
    print_info "Installing Nginx..."
    apt install -y nginx > /dev/null 2>&1
    
    systemctl start nginx
    systemctl enable nginx > /dev/null 2>&1
    
    print_status "Nginx installed: $(nginx -v 2>&1)"
}

setup_directory() {
    print_section "Setting Up Application Directory"
    
    print_info "Creating directory structure..."
    mkdir -p $APP_DIR
    mkdir -p $LOG_DIR
    
    # Set ownership
    if [ -n "$SUDO_USER" ]; then
        chown -R $SUDO_USER:$SUDO_USER $APP_DIR
        print_status "Directory ownership set to $SUDO_USER"
    fi
    
    print_status "Directory created: $APP_DIR"
    print_status "Logs directory created: $LOG_DIR"
}

configure_nginx() {
    print_section "Configuring Nginx"
    
    print_info "Creating Nginx configuration..."
    
    cat > /etc/nginx/sites-available/eventhub << 'NGINX_EOF'
# EventHub API Gateway Configuration

upstream api_gateway {
    least_conn;
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
}

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 80;
    listen [::]:80;
    server_name _;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/eventhub-access.log;
    error_log /var/log/nginx/eventhub-error.log warn;

    # Client settings
    client_max_body_size 10M;
    client_body_timeout 60s;
    client_header_timeout 60s;

    # Proxy timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # Main API routes
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        limit_req_status 429;

        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_buffering off;
        
        # CORS
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
        add_header Access-Control-Max-Age 3600 always;
        
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "*" always;
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    # Auth endpoints - stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        limit_req_status 429;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        add_header Access-Control-Allow-Origin "*" always;
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # Health check
    location /health {
        proxy_pass http://api_gateway/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        access_log off;
    }

    # Root
    location = / {
        default_type application/json;
        return 200 '{"status":"EventHub API","version":"1.0.0","message":"API is running"}';
    }

    # 404 handler
    location / {
        default_type application/json;
        return 404 '{"error":"Not Found","message":"Endpoint does not exist"}';
    }
}
NGINX_EOF

    # Create symlink
    ln -sf /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/
    
    # Remove default site
    rm -f /etc/nginx/sites-enabled/default
    
    # Test configuration
    print_info "Testing Nginx configuration..."
    if nginx -t > /dev/null 2>&1; then
        print_status "Nginx configuration is valid"
        systemctl reload nginx
        print_status "Nginx reloaded successfully"
    else
        print_error "Nginx configuration test failed"
        nginx -t
        exit 1
    fi
}

setup_firewall() {
    print_section "Configuring UFW Firewall"
    
    print_info "Enabling firewall rules..."
    
    # Reset UFW to defaults
    ufw --force reset > /dev/null 2>&1
    
    # Default policies
    ufw default deny incoming > /dev/null 2>&1
    ufw default allow outgoing > /dev/null 2>&1
    
    # Allow SSH (important!)
    ufw allow 22/tcp > /dev/null 2>&1
    print_status "Allowed SSH (port 22)"
    
    # Allow HTTP and HTTPS
    ufw allow 80/tcp > /dev/null 2>&1
    print_status "Allowed HTTP (port 80)"
    
    ufw allow 443/tcp > /dev/null 2>&1
    print_status "Allowed HTTPS (port 443)"
    
    # Enable firewall
    ufw --force enable > /dev/null 2>&1
    print_status "Firewall enabled"
}

configure_fail2ban() {
    print_section "Configuring Fail2Ban"
    
    print_info "Setting up Fail2Ban for Nginx..."
    
    # Create jail for Nginx
    cat > /etc/fail2ban/jail.local << 'FAIL2BAN_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true
port = http,https
logpath = /var/log/nginx/eventhub-error.log

[nginx-limit-req]
enabled = true
port = http,https
logpath = /var/log/nginx/eventhub-error.log
maxretry = 10
FAIL2BAN_EOF

    systemctl restart fail2ban
    systemctl enable fail2ban > /dev/null 2>&1
    
    print_status "Fail2Ban configured and running"
}

create_pm2_config() {
    print_section "Creating PM2 Ecosystem File"
    
    cat > $APP_DIR/ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: '/home/user1/personal/providers_hub/services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/user1/personal/providers_hub/logs/api-gateway-error.log',
      out_file: '/home/user1/personal/providers_hub/logs/api-gateway-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    },
    {
      name: 'user-service',
      cwd: '/home/user1/personal/providers_hub/services/user-service',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/user1/personal/providers_hub/logs/user-service-error.log',
      out_file: '/home/user1/personal/providers_hub/logs/user-service-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      autorestart: true,
      watch: false
    }
  ]
};
PM2_EOF

    if [ -n "$SUDO_USER" ]; then
        chown $SUDO_USER:$SUDO_USER $APP_DIR/ecosystem.config.js
    fi
    
    print_status "PM2 ecosystem file created"
}

create_helper_scripts() {
    print_section "Creating Helper Scripts"
    
    # Start script
    cat > $APP_DIR/start.sh << 'SCRIPT_EOF'
#!/bin/bash
cd /home/user1/personal/providers_hub
docker-compose up -d postgres redis kafka
sleep 10
pm2 start ecosystem.config.js
pm2 save
SCRIPT_EOF
    chmod +x $APP_DIR/start.sh
    print_status "Created start.sh"
    
    # Stop script
    cat > $APP_DIR/stop.sh << 'SCRIPT_EOF'
#!/bin/bash
pm2 stop all
docker-compose down
SCRIPT_EOF
    chmod +x $APP_DIR/stop.sh
    print_status "Created stop.sh"
    
    # Status script
    cat > $APP_DIR/status.sh << 'SCRIPT_EOF'
#!/bin/bash
echo "=== PM2 Services ==="
pm2 status
echo ""
echo "=== Docker Containers ==="
docker ps
echo ""
echo "=== Nginx Status ==="
systemctl status nginx --no-pager
SCRIPT_EOF
    chmod +x $APP_DIR/status.sh
    print_status "Created status.sh"
    
    # Logs script
    cat > $APP_DIR/logs.sh << 'SCRIPT_EOF'
#!/bin/bash
case "$1" in
    pm2)
        pm2 logs
        ;;
    nginx)
        tail -f /var/log/nginx/eventhub-*.log
        ;;
    docker)
        docker-compose logs -f
        ;;
    all)
        pm2 logs &
        tail -f /var/log/nginx/eventhub-*.log &
        docker-compose logs -f
        ;;
    *)
        echo "Usage: ./logs.sh [pm2|nginx|docker|all]"
        ;;
esac
SCRIPT_EOF
    chmod +x $APP_DIR/logs.sh
    print_status "Created logs.sh"
    
    if [ -n "$SUDO_USER" ]; then
        chown $SUDO_USER:$SUDO_USER $APP_DIR/*.sh
    fi
}

setup_logrotate() {
    print_section "Configuring Log Rotation"
    
    cat > /etc/logrotate.d/eventhub << 'LOGROTATE_EOF'
/home/user1/personal/providers_hub/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
LOGROTATE_EOF

    print_status "Log rotation configured"
}

print_next_steps() {
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  ✓ Installation Complete!${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "${GREEN}Next Steps:${NC}"
    echo ""
    echo "1. Upload your EventHub backend code:"
    echo -e "   ${YELLOW}scp -r eventhub-backend/ user@server:$APP_DIR/${NC}"
    echo ""
    echo "2. Navigate to the directory:"
    echo -e "   ${YELLOW}cd $APP_DIR${NC}"
    echo ""
    echo "3. Build the backend:"
    echo -e "   ${YELLOW}bash setup.sh${NC}"
    echo ""
    echo "4. Start infrastructure services:"
    echo -e "   ${YELLOW}docker-compose up -d postgres redis kafka${NC}"
    echo -e "   ${YELLOW}sleep 60  # Wait for services to be ready${NC}"
    echo ""
    echo "5. Run database migrations:"
    echo -e "   ${YELLOW}cd services/user-service${NC}"
    echo -e "   ${YELLOW}npx prisma migrate deploy${NC}"
    echo -e "   ${YELLOW}cd ../..${NC}"
    echo ""
    echo "6. Start application services:"
    echo -e "   ${YELLOW}pm2 start ecosystem.config.js${NC}"
    echo -e "   ${YELLOW}pm2 save${NC}"
    echo ""
    echo "7. Setup PM2 startup:"
    echo -e "   ${YELLOW}pm2 startup${NC}"
    echo -e "   ${YELLOW}# Then run the command that PM2 outputs${NC}"
    echo ""
    echo -e "${GREEN}Helper Scripts Available:${NC}"
    echo -e "   ${YELLOW}./start.sh${NC}   - Start all services"
    echo -e "   ${YELLOW}./stop.sh${NC}    - Stop all services"
    echo -e "   ${YELLOW}./status.sh${NC}  - Check service status"
    echo -e "   ${YELLOW}./logs.sh all${NC} - View all logs"
    echo ""
    echo -e "${GREEN}Verify Deployment:${NC}"
    echo -e "   ${YELLOW}curl http://localhost/health${NC}"
    echo ""
    echo -e "${GREEN}Access Your API:${NC}"
    SERVER_IP=$(hostname -I | awk '{print $1}')
    echo -e "   ${YELLOW}http://$SERVER_IP/api/${NC}"
    echo -e "   ${YELLOW}http://$SERVER_IP/health${NC}"
    echo ""
    echo -e "${GREEN}View Logs:${NC}"
    echo -e "   PM2:    ${YELLOW}pm2 logs${NC}"
    echo -e "   Nginx:  ${YELLOW}sudo tail -f /var/log/nginx/eventhub-*.log${NC}"
    echo -e "   Docker: ${YELLOW}docker-compose logs -f${NC}"
    echo ""
    echo -e "${GREEN}Optional - Setup SSL:${NC}"
    echo -e "   ${YELLOW}sudo apt install certbot python3-certbot-nginx${NC}"
    echo -e "   ${YELLOW}sudo certbot --nginx -d yourdomain.com${NC}"
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════════${NC}"
    echo ""
}

print_summary() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Installation Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo ""
    echo -e "Node.js:         ${GREEN}$(node --version)${NC}"
    echo -e "npm:             ${GREEN}$(npm --version)${NC}"
    echo -e "Docker:          ${GREEN}$(docker --version | cut -d' ' -f3 | tr -d ',')${NC}"
    echo -e "Docker Compose:  ${GREEN}$(docker-compose --version | cut -d' ' -f4 | tr -d ',')${NC}"
    echo -e "PM2:             ${GREEN}$(pm2 --version)${NC}"
    echo -e "Nginx:           ${GREEN}$(nginx -v 2>&1 | cut -d'/' -f2)${NC}"
    echo ""
    echo -e "App Directory:   ${GREEN}$APP_DIR${NC}"
    echo -e "Logs Directory:  ${GREEN}$LOG_DIR${NC}"
    echo ""
}

main() {
    print_banner
    
    check_root
    check_ubuntu
    
    install_dependencies
    install_node
    install_docker
    install_docker_compose
    install_pm2
    install_nginx
    
    setup_directory
    configure_nginx
    setup_firewall
    configure_fail2ban
    create_pm2_config
    create_helper_scripts
    setup_logrotate
    
    print_summary
    print_next_steps
    
    print_status "Deployment script completed successfully!"
}

# Run main function
main
