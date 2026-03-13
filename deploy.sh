#!/bin/bash

# EventHub Backend - Automated Ubuntu Deployment Script
# This script automates the deployment of EventHub microservices on Ubuntu

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="//home/user1/personal/providers_hub"
DOMAIN="providerapi.erb.go.ug"  # Change this to your domain

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
       print_error "This script must be run as root (use sudo)"
       exit 1
    fi
}

install_node() {
    print_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    print_status "Node.js installed: $(node --version)"
}

install_docker() {
    print_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    
    # Add current user to docker group
    usermod -aG docker $SUDO_USER
    
    print_status "Docker installed: $(docker --version)"
}

install_docker_compose() {
    print_info "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_status "Docker Compose installed: $(docker-compose --version)"
}

install_pm2() {
    print_info "Installing PM2..."
    npm install -g pm2
    print_status "PM2 installed: $(pm2 --version)"
}

install_nginx() {
    print_info "Installing Nginx..."
    apt install -y nginx
    systemctl enable nginx
    print_status "Nginx installed: $(nginx -v 2>&1)"
}

setup_directory() {
    print_info "Setting up application directory..."
    mkdir -p $APP_DIR
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR
    mkdir -p $APP_DIR/logs
    print_status "Directory created: $APP_DIR"
}

configure_nginx() {
    print_info "Configuring Nginx..."
    
    cat > /etc/nginx/sites-available/eventhub.conf << 'NGINX_EOF'
upstream api_gateway {
    least_conn;
    server localhost:3000;
}

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

server {
    listen 80;
    server_name _;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/eventhub-access.log;
    error_log /var/log/nginx/eventhub-error.log;

    client_max_body_size 10M;

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /health {
        proxy_pass http://api_gateway/health;
        access_log off;
    }

    location / {
        return 200 '{"status":"EventHub API is running"}';
        add_header Content-Type application/json;
    }
}
NGINX_EOF

    ln -sf /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    nginx -t
    systemctl reload nginx
    
    print_status "Nginx configured"
}

setup_firewall() {
    print_info "Configuring UFW firewall..."
    ufw --force enable
    ufw allow 22/tcp
    ufw allow 80/tcp
    ufw allow 443/tcp
    print_status "Firewall configured"
}

create_pm2_config() {
    print_info "Creating PM2 ecosystem file..."
    
    cat > $APP_DIR/ecosystem.config.js << 'PM2_EOF'
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: '//home/user1/personal/providers_hub/services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '//home/user1/personal/providers_hub/logs/api-gateway-error.log',
      out_file: '//home/user1/personal/providers_hub/logs/api-gateway-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'user-service',
      cwd: '//home/user1/personal/providers_hub/services/user-service',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '//home/user1/personal/providers_hub/logs/user-service-error.log',
      out_file: '//home/user1/personal/providers_hub/logs/user-service-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
PM2_EOF

    chown $SUDO_USER:$SUDO_USER $APP_DIR/ecosystem.config.js
    print_status "PM2 config created"
}

print_next_steps() {
    echo ""
    echo "========================================="
    echo "✓ System Setup Complete!"
    echo "========================================="
    echo ""
    echo "Next steps:"
    echo "1. Upload your EventHub backend to: $APP_DIR"
    echo "2. Run setup script:"
    echo "   cd $APP_DIR && bash setup.sh"
    echo ""
    echo "3. Start infrastructure:"
    echo "   cd $APP_DIR && docker-compose up -d postgres redis kafka"
    echo ""
    echo "4. Run migrations:"
    echo "   cd $APP_DIR/services/user-service && npx prisma migrate deploy"
    echo ""
    echo "5. Start services:"
    echo "   cd $APP_DIR && pm2 start ecosystem.config.js"
    echo "   pm2 save"
    echo ""
    echo "6. Test deployment:"
    echo "   curl http://localhost/health"
    echo ""
    echo "Your API will be available at: http://your-server-ip/api/"
    echo ""
    echo "View logs:"
    echo "  - PM2: pm2 logs"
    echo "  - Nginx: sudo tail -f /var/log/nginx/eventhub-error.log"
    echo "  - Docker: docker-compose logs"
    echo ""
}

main() {
    echo "========================================="
    echo "EventHub Backend - Ubuntu Deployment"
    echo "========================================="
    echo ""
    
    check_root
    
    # Update system
    print_info "Updating system packages..."
    apt update && apt upgrade -y
    apt install -y curl git build-essential
    
    # Install components
    install_node
    install_docker
    install_docker_compose
    install_pm2
    install_nginx
    
    # Setup
    setup_directory
    configure_nginx
    setup_firewall
    create_pm2_config
    
    print_next_steps
}

# Run main function
main
