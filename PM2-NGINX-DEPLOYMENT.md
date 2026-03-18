# EventHub - PM2 & Nginx Deployment Guide

## 📦 Files Provided

1. **ecosystem.config.js** - Complete PM2 configuration for all 9 microservices
2. **nginx-providerapi.conf** - Updated Nginx config for providerapi.erb.go.ug

---

## 🚀 Step 1: Deploy PM2 Ecosystem Config

### Upload the file
```bash
scp ecosystem.config.js user1@providerapi.erb.go.ug:/home/user1/personal/providers_hub/
```

### Or create it directly on server
```bash
nano /home/user1/personal/providers_hub/ecosystem.config.js
# Paste the content
```

---

## 🔧 Step 2: Start All Services with PM2

```bash
cd /home/user1/personal/providers_hub

# Stop any running PM2 processes
pm2 delete all

# Start all services from ecosystem config
pm2 start ecosystem.config.js

# Check status
pm2 status

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
# Run the command that PM2 outputs
```

### Expected Output
```
┌─────────────────────┬────┬─────────┬──────┬───────┐
│ App name            │ id │ mode    │ pid  │ status│
├─────────────────────┼────┼─────────┼──────┼───────┤
│ api-gateway         │ 0  │ cluster │ 1234 │ online│
│ api-gateway         │ 1  │ cluster │ 1235 │ online│
│ user-service        │ 2  │ cluster │ 1236 │ online│
│ user-service        │ 3  │ cluster │ 1237 │ online│
│ profile-service     │ 4  │ cluster │ 1238 │ online│
│ profile-service     │ 5  │ cluster │ 1239 │ online│
│ catalog-service     │ 6  │ cluster │ 1240 │ online│
│ catalog-service     │ 7  │ cluster │ 1241 │ online│
│ inquiry-service     │ 8  │ cluster │ 1242 │ online│
│ inquiry-service     │ 9  │ cluster │ 1243 │ online│
│ payment-service     │ 10 │ cluster │ 1244 │ online│
│ payment-service     │ 11 │ cluster │ 1245 │ online│
│ review-service      │ 12 │ cluster │ 1246 │ online│
│ review-service      │ 13 │ cluster │ 1247 │ online│
│ notification-service│ 14 │ fork    │ 1248 │ online│
│ media-service       │ 15 │ cluster │ 1249 │ online│
│ media-service       │ 16 │ cluster │ 1250 │ online│
└─────────────────────┴────┴─────────┴──────┴───────┘
```

---

## 🌐 Step 3: Update Nginx Configuration

### Backup current config
```bash
sudo cp /etc/nginx/sites-available/eventhub /etc/nginx/sites-available/eventhub.backup
```

### Update the config
```bash
sudo nano /etc/nginx/sites-available/eventhub
# Replace content with nginx-providerapi.conf
```

### Or upload directly
```bash
scp nginx-providerapi.conf user1@providerapi.erb.go.ug:/tmp/
sudo mv /tmp/nginx-providerapi.conf /etc/nginx/sites-available/eventhub
```

### Test and reload
```bash
# Test configuration
sudo nginx -t

# If successful, reload
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

---

## ✅ Step 4: Verify Deployment

### Test API Gateway
```bash
curl http://localhost:3000/health
# Expected: {"status":"healthy"}
```

### Test through Nginx
```bash
curl http://providerapi.erb.go.ug/health
# Expected: {"status":"healthy"}

curl http://providerapi.erb.go.ug/
# Expected: {"status":"EventHub API","version":"1.0.0",...}
```

### Test from external
```bash
# From your local machine
curl http://providerapi.erb.go.ug/health
curl http://providerapi.erb.go.ug/api/auth/login
```

---

## 📊 Monitoring Commands

### PM2 Monitoring
```bash
# View all logs
pm2 logs

# View specific service
pm2 logs api-gateway
pm2 logs user-service

# Real-time monitoring
pm2 monit

# Service status
pm2 status

# Memory usage
pm2 list
```

### Nginx Monitoring
```bash
# View access logs
sudo tail -f /var/log/nginx/eventhub-access.log

# View error logs
sudo tail -f /var/log/nginx/eventhub-error.log

# Check Nginx status
sudo systemctl status nginx
```

---

## 🔄 Service Management

### Restart specific service
```bash
pm2 restart api-gateway
pm2 restart user-service
```

### Restart all services
```bash
pm2 restart all
```

### Reload without downtime
```bash
pm2 reload all
```

### Stop services
```bash
pm2 stop all
```

### Delete all PM2 processes
```bash
pm2 delete all
```

---

## 🛠️ Troubleshooting

### Service won't start
```bash
# Check logs
pm2 logs api-gateway --lines 50

# Check if port is available
sudo lsof -i :3000

# Check environment variables
pm2 env 0  # Replace 0 with app id

# Restart service
pm2 restart api-gateway
```

### Nginx 502 Bad Gateway
```bash
# Check if services are running
pm2 status

# Test API Gateway directly
curl http://localhost:3000/health

# Check Nginx logs
sudo tail -f /var/log/nginx/eventhub-error.log

# Restart services
pm2 restart all
sudo systemctl restart nginx
```

### High memory usage
```bash
# Check memory
pm2 list

# Reduce instances (in ecosystem.config.js, change instances to 1)
pm2 delete all
pm2 start ecosystem.config.js
```

---

## 📍 Service Endpoints

All services are accessed through the API Gateway at `providerapi.erb.go.ug`:

| Service | Port | Nginx Route | Description |
|---------|------|-------------|-------------|
| API Gateway | 3000 | `/api/*` | Main entry point |
| User Service | 3001 | `/api/auth/*`, `/api/users/*` | Authentication & users |
| Profile Service | 3002 | `/api/profiles/*` | Provider profiles |
| Catalog Service | 3003 | `/api/catalog/*` | Service listings |
| Inquiry Service | 3004 | `/api/inquiries/*` | Booking inquiries |
| Payment Service | 3005 | `/api/payments/*` | Payment processing |
| Review Service | 3006 | `/api/reviews/*` | Ratings & reviews |
| Notification Service | 3007 | `/api/notifications/*` | Notifications |
| Media Service | 3008 | `/api/media/*` | File uploads |

---

## 🔐 Setup SSL (Optional but Recommended)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d providerapi.erb.go.ug

# Test auto-renewal
sudo certbot renew --dry-run
```

After SSL is setup, uncomment the SSL sections in the Nginx config.

---

## 📝 PM2 Ecosystem Features

### What's Configured:

✅ **17 instances total** - 2 instances per service (except notifications: 1)
✅ **Cluster mode** - Load balancing across CPU cores
✅ **Auto-restart** - Restarts on crash
✅ **Memory limit** - Restarts if > 500MB
✅ **Log management** - Separate error and output logs
✅ **Timestamps** - All logs have timestamps
✅ **Min uptime** - Must run 10s before considered stable
✅ **Max restarts** - Stops trying after 10 rapid restarts

---

## 🎯 Quick Commands Cheat Sheet

```bash
# Start everything
pm2 start ecosystem.config.js

# Stop everything
pm2 stop all

# Restart everything
pm2 restart all

# View logs
pm2 logs

# Monitor
pm2 monit

# Status
pm2 status

# Save state
pm2 save

# Test Nginx
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Test API
curl http://providerapi.erb.go.ug/health
```

---

Your EventHub backend is now fully deployed with all microservices! 🚀
