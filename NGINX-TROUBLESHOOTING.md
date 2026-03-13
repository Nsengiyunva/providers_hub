# Nginx Configuration Troubleshooting Guide

## Common Nginx Test Failures

### 1. Check What the Error Is

```bash
# Test configuration and see detailed error
sudo nginx -t

# Check Nginx error log
sudo tail -50 /var/log/nginx/error.log
```

### 2. Common Issues & Solutions

#### Issue: "unknown directive" or "unexpected end of file"

**Cause:** Missing semicolon or bracket

**Solution:**
```bash
# Check for syntax errors
sudo nginx -t 2>&1 | grep -i error

# Common fixes:
# - Add semicolon at end of line
# - Check all { have matching }
# - Remove any invisible characters
```

#### Issue: "duplicate location" or "conflicting server name"

**Cause:** Multiple configurations with same location or server_name

**Solution:**
```bash
# Check for duplicate configs
sudo nginx -T | grep "location /api"

# Remove duplicate sites
sudo rm /etc/nginx/sites-enabled/default
sudo ls -la /etc/nginx/sites-enabled/
```

#### Issue: "upstream not found" or "host not found"

**Cause:** Backend service not running or wrong address

**Solution:**
```bash
# Check if backend is running
curl http://localhost:3000/health

# Check PM2 status
pm2 status

# Use 127.0.0.1 instead of localhost
# Change: server localhost:3000;
# To:     server 127.0.0.1:3000;
```

#### Issue: Rate limiting errors

**Cause:** Rate limit zones not properly defined

**Solution:**
```bash
# Ensure rate limits are before server block
# They should be at top level, not inside server {}
```

## Step-by-Step Fix Process

### Step 1: Backup Current Config

```bash
sudo cp /etc/nginx/sites-available/eventhub /etc/nginx/sites-available/eventhub.backup
```

### Step 2: Use the Corrected Config

```bash
# Copy the corrected config
sudo nano /etc/nginx/sites-available/eventhub

# Paste the corrected configuration (from nginx-eventhub.conf)
```

### Step 3: Test Configuration

```bash
# Test syntax
sudo nginx -t

# If successful, you'll see:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### Step 4: Enable Site and Reload

```bash
# Create symlink (if not exists)
sudo ln -sf /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Reload Nginx
sudo systemctl reload nginx

# Check status
sudo systemctl status nginx
```

## Complete Working Configuration

Save this as `/etc/nginx/sites-available/eventhub`:

```nginx
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

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/eventhub-access.log;
    error_log /var/log/nginx/eventhub-error.log warn;

    client_max_body_size 10M;

    location /api/ {
        limit_req zone=api_limit burst=20 nodelay;
        
        proxy_pass http://api_gateway;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_cache_bypass $http_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        add_header Access-Control-Allow-Origin "*" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, PATCH, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, Accept" always;
        
        if ($request_method = 'OPTIONS') {
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }

    location /api/auth/ {
        limit_req zone=auth_limit burst=3 nodelay;
        
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

    location /health {
        proxy_pass http://api_gateway/health;
        access_log off;
    }

    location = / {
        default_type application/json;
        return 200 '{"status":"EventHub API is running"}';
    }
}
```

## Verification Steps

### 1. Test Backend is Running

```bash
# Check if API Gateway is running
curl http://localhost:3000/health

# Should return: {"status":"healthy"}
```

### 2. Test Nginx Configuration

```bash
# Test config
sudo nginx -t

# Expected output:
# nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
# nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 3. Reload Nginx

```bash
sudo systemctl reload nginx
```

### 4. Test Through Nginx

```bash
# Test health endpoint
curl http://localhost/health

# Test API endpoint (should return 401 if auth required)
curl http://localhost/api/auth/me

# From outside server
curl http://YOUR_SERVER_IP/health
```

## Common Debugging Commands

```bash
# Check Nginx is running
sudo systemctl status nginx

# View Nginx error log in real-time
sudo tail -f /var/log/nginx/error.log

# View Nginx access log
sudo tail -f /var/log/nginx/eventhub-access.log

# Check which config files are loaded
sudo nginx -T | less

# Check for conflicting configs
sudo nginx -T | grep "listen 80"

# Restart Nginx (if reload doesn't work)
sudo systemctl restart nginx

# Check if port 80 is in use
sudo netstat -tlnp | grep :80
# or
sudo lsof -i :80
```

## If Still Failing

### Option 1: Start with Minimal Config

```nginx
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Test this first, then gradually add features.

### Option 2: Check Nginx Main Config

```bash
# Edit main config
sudo nano /etc/nginx/nginx.conf

# Ensure http block includes sites-enabled
# Should have:
include /etc/nginx/sites-enabled/*;
```

### Option 3: Check File Permissions

```bash
# Nginx config should be readable
sudo chmod 644 /etc/nginx/sites-available/eventhub

# Check ownership
ls -la /etc/nginx/sites-available/eventhub
```

## Quick Fix Script

```bash
#!/bin/bash

# Remove old config
sudo rm -f /etc/nginx/sites-enabled/eventhub
sudo rm -f /etc/nginx/sites-available/eventhub

# Create new config
sudo tee /etc/nginx/sites-available/eventhub > /dev/null << 'EOF'
upstream api_gateway {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
EOF

# Enable site
sudo ln -s /etc/nginx/sites-available/eventhub /etc/nginx/sites-enabled/

# Test and reload
sudo nginx -t && sudo systemctl reload nginx
```

## Success Checklist

- [ ] `sudo nginx -t` passes successfully
- [ ] Nginx reloads without errors
- [ ] `curl http://localhost/health` returns response
- [ ] Backend services are running (`pm2 status`)
- [ ] No errors in `/var/log/nginx/error.log`

If you're still having issues, share the exact error message from `sudo nginx -t` for specific help!
