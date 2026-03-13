# EventHub Backend - Ubuntu Deployment Guide

Complete guide to deploy EventHub microservices on Ubuntu VM with Nginx reverse proxy.

## 📋 Prerequisites

- Ubuntu 20.04 or 22.04 LTS
- Sudo privileges
- Domain name (optional, but recommended)

## 🚀 Quick Deployment

```bash
# Download and run deployment script
curl -o deploy.sh https://your-server/deploy.sh
chmod +x deploy.sh
sudo ./deploy.sh
```

## 📦 Step-by-Step Deployment

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl git build-essential nginx

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installations
node --version  # Should be v20.x
npm --version   # Should be 10.x
nginx -v        # Should be 1.18+
```

### 2. Install Docker & Docker Compose

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version
```

### 3. Install PM2 (Process Manager)

```bash
# Install PM2 globally
sudo npm install -g pm2

# Setup PM2 startup script
pm2 startup
# Run the command that PM2 outputs

# Verify
pm2 --version
```

### 4. Clone and Setup Backend

```bash
# Create application directory
sudo mkdir -p /var/www/eventhub
sudo chown -R $USER:$USER /var/www/eventhub
cd /var/www/eventhub

# Upload your backend (via git, scp, or other method)
# If using git:
git clone https://github.com/your-repo/eventhub-backend.git .

# Or if uploading tar file:
scp eventhub-backend-final.tar.gz user@your-server:/var/www/eventhub/
tar -xzf eventhub-backend-final.tar.gz
mv eventhub-backend/* .
```

### 5. Build Shared Packages

```bash
cd /var/www/eventhub

# Run setup script
bash setup.sh

# Or manually:
npm install
cd shared/types && npm install && npm run build && cd ../..
cd shared/utils && npm install && npm run build && cd ../..
```

### 6. Setup Each Microservice

```bash
# User Service
cd /var/www/eventhub/services/user-service
npm install
npm run build

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3001
DATABASE_URL="postgresql://eventhub:eventhub123@localhost:5432/eventhub"
REDIS_URL="redis://localhost:6379"
KAFKA_BROKERS="localhost:9092"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
JWT_REFRESH_SECRET="your-super-secret-refresh-key-change-this-in-production"
EOF

# Generate Prisma client
npx prisma generate

# API Gateway
cd /var/www/eventhub/services/api-gateway
npm install
npm run build

# Create .env file
cat > .env << EOF
NODE_ENV=production
PORT=3000
USER_SERVICE_URL="http://localhost:3001"
PROFILE_SERVICE_URL="http://localhost:3002"
CATALOG_SERVICE_URL="http://localhost:3003"
INQUIRY_SERVICE_URL="http://localhost:3004"
PAYMENT_SERVICE_URL="http://localhost:3005"
REVIEW_SERVICE_URL="http://localhost:3006"
NOTIFICATION_SERVICE_URL="http://localhost:3007"
MEDIA_SERVICE_URL="http://localhost:3008"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"
EOF
```

### 7. Start Infrastructure Services

```bash
cd /var/www/eventhub

# Start infrastructure with Docker Compose
docker-compose up -d postgres redis kafka

# Wait for services to be ready (30-60 seconds)
sleep 60

# Verify services are running
docker ps

# Check logs
docker-compose logs postgres
docker-compose logs redis
docker-compose logs kafka
```

### 8. Run Database Migrations

```bash
cd /var/www/eventhub/services/user-service

# Run Prisma migrations
npx prisma migrate deploy

# Verify database
docker exec -it eventhub-postgres psql -U eventhub -d eventhub -c "\dt"
```

### 9. Create PM2 Ecosystem File

```bash
cd /var/www/eventhub

cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'api-gateway',
      cwd: '/var/www/eventhub/services/api-gateway',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/www/eventhub/logs/api-gateway-error.log',
      out_file: '/var/www/eventhub/logs/api-gateway-out.log',
      merge_logs: true,
      time: true
    },
    {
      name: 'user-service',
      cwd: '/var/www/eventhub/services/user-service',
      script: 'dist/index.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/var/www/eventhub/logs/user-service-error.log',
      out_file: '/var/www/eventhub/logs/user-service-out.log',
      merge_logs: true,
      time: true
    }
  ]
};
EOF

# Create logs directory
mkdir -p /var/www/eventhub/logs
```

### 10. Start Services with PM2

```bash
cd /var/www/eventhub

# Start all services
pm2 start ecosystem.config.js

# Check status
pm2 status

# View logs
pm2 logs

# Save PM2 process list
pm2 save

# Setup auto-restart on reboot (if not done earlier)
pm2 startup
# Run the command output by PM2
```

### 11. Configure Nginx as Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/eventhub

# Add the following configuration:
```

```nginx
# /etc/nginx/sites-available/eventhub

# Upstream definitions for microservices
upstream api_gateway {
    least_conn;
    server localhost:3000;
}

upstream user_service {
    least_conn;
    server localhost:3001;
}

# Add other services as needed
# upstream profile_service {
#     server localhost:3002;
# }

# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=100r/m;
limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=5r/m;

# Main server block
server {
    listen 80;
    server_name eventhub.yourdomain.com;  # Change this to your domain

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Logging
    access_log /var/log/nginx/eventhub-access.log;
    error_log /var/log/nginx/eventhub-error.log;

    # Client body size limit (for file uploads)
    client_max_body_size 10M;

    # Timeouts
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;

    # API Gateway - Main endpoint
    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_cache_bypass $http_upgrade;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS (if needed)
        add_header Access-Control-Allow-Origin * always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type" always;
        
        if ($request_method = OPTIONS) {
            return 204;
        }
    }

    # Auth endpoints - stricter rate limiting
    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://api_gateway/health;
        access_log off;
    }

    # Default response for root
    location / {
        return 200 '{"status":"EventHub API is running","version":"1.0.0"}';
        add_header Content-Type application/json;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

### 12. Setup SSL with Let's Encrypt (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d eventhub.yourdomain.com

# Certbot will automatically update your Nginx config

# Test auto-renewal
sudo certbot renew --dry-run

# Certs will auto-renew via cron
```

### 13. Setup UFW Firewall

```bash
# Enable UFW
sudo ufw enable

# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Check status
sudo ufw status
```

### 14. Monitoring and Logs

```bash
# View PM2 logs
pm2 logs
pm2 logs api-gateway
pm2 logs user-service

# View Nginx logs
sudo tail -f /var/log/nginx/eventhub-access.log
sudo tail -f /var/log/nginx/eventhub-error.log

# View Docker logs
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f kafka

# PM2 monitoring
pm2 monit

# System resources
htop  # Install with: sudo apt install htop
```

## 🔄 Deployment Updates

### Update Backend Code

```bash
cd /var/www/eventhub

# Pull latest code
git pull origin main

# Rebuild shared packages
cd shared/types && npm run build && cd ../..
cd shared/utils && npm run build && cd ../..

# Rebuild services
cd services/api-gateway && npm run build && cd ../..
cd services/user-service && npm run build && cd ../..

# Restart services
pm2 restart all

# Or restart specific service
pm2 restart api-gateway
```

### Zero-Downtime Deployment

```bash
# Reload services one by one
pm2 reload api-gateway
pm2 reload user-service

# PM2 will gracefully reload without downtime
```

## 🛠️ Troubleshooting

### Service Not Starting

```bash
# Check PM2 logs
pm2 logs api-gateway --lines 100

# Check if port is in use
sudo lsof -i :3000

# Check environment variables
pm2 env 0  # 0 is the app id from pm2 status
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it eventhub-postgres psql -U eventhub -d eventhub

# Check connection string in .env
cat services/user-service/.env | grep DATABASE_URL
```

### Nginx 502 Bad Gateway

```bash
# Check if backend services are running
pm2 status

# Check Nginx error logs
sudo tail -f /var/log/nginx/eventhub-error.log

# Test backend directly
curl http://localhost:3000/health

# Restart Nginx
sudo systemctl restart nginx
```

### High Memory Usage

```bash
# Check memory
free -h

# Reduce PM2 instances
pm2 scale api-gateway 1

# Restart with lower instances
pm2 delete all
pm2 start ecosystem.config.js
```

## 📊 Performance Optimization

### Enable Nginx Caching

Add to your Nginx config:

```nginx
# Cache configuration
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api/profiles {
    proxy_cache api_cache;
    proxy_cache_valid 200 5m;
    proxy_cache_use_stale error timeout http_500 http_502 http_503;
    add_header X-Cache-Status $upstream_cache_status;
    
    proxy_pass http://api_gateway;
}
```

### Enable Gzip Compression

Add to Nginx config:

```nginx
# Gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types application/json application/javascript text/css text/plain;
```

## 🔐 Security Best Practices

### 1. Change Default Passwords

```bash
# Update PostgreSQL password
docker exec -it eventhub-postgres psql -U postgres
ALTER USER eventhub WITH PASSWORD 'new-secure-password';

# Update .env files with new password
```

### 2. Use Environment Variables

```bash
# Never commit .env files to git
echo ".env" >> .gitignore

# Store secrets securely (use vault in production)
```

### 3. Enable HTTPS Only

```nginx
# Force HTTPS redirect
server {
    listen 80;
    server_name eventhub.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### 4. Rate Limiting

Already configured in Nginx config above.

## 📝 Service URLs

After deployment, services will be available at:

- **API Gateway**: `https://eventhub.yourdomain.com/api/`
- **Health Check**: `https://eventhub.yourdomain.com/health`
- **Auth**: `https://eventhub.yourdomain.com/api/auth/*`
- **Profiles**: `https://eventhub.yourdomain.com/api/profiles/*`
- **Inquiries**: `https://eventhub.yourdomain.com/api/inquiries/*`

## 🎯 Final Checklist

- [ ] All infrastructure services running (PostgreSQL, Redis, Kafka)
- [ ] Database migrations completed
- [ ] All microservices running via PM2
- [ ] Nginx configured and running
- [ ] SSL certificate installed (if using HTTPS)
- [ ] Firewall configured
- [ ] PM2 startup script configured
- [ ] Logs accessible and rotating
- [ ] Health checks returning 200 OK
- [ ] Frontend can connect to backend

## 📚 Useful Commands

```bash
# Restart everything
pm2 restart all
sudo systemctl restart nginx
docker-compose restart

# Stop everything
pm2 stop all
sudo systemctl stop nginx
docker-compose down

# View all logs
pm2 logs --lines 100

# Monitor in real-time
pm2 monit

# Check resource usage
pm2 list
docker stats
```

## 🆘 Support

For issues or questions:
1. Check logs: `pm2 logs`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/eventhub-error.log`
3. Check Docker logs: `docker-compose logs`

Your EventHub backend is now production-ready on Ubuntu with Nginx! 🚀
