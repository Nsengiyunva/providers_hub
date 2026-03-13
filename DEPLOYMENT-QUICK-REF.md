# EventHub - Quick Deployment Reference

## 🚀 One-Command Deployment

```bash
# Run automated setup
sudo bash deploy.sh
```

## 📦 Service Architecture

```
Internet → Nginx (Port 80/443) → API Gateway (Port 3000) → Microservices
                                                            ├─ User Service (3001)
                                                            ├─ Profile Service (3002)
                                                            ├─ Catalog Service (3003)
                                                            └─ ... (other services)
```

## 🔄 Service Management

### Start All Services
```bash
pm2 start ecosystem.config.js
pm2 save
```

### Stop All Services
```bash
pm2 stop all
```

### Restart All Services
```bash
pm2 restart all
```

### View Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs              # All services
pm2 logs api-gateway  # Specific service
pm2 logs --lines 100  # Last 100 lines
```

## 🐳 Docker Management

### Start Infrastructure
```bash
docker-compose up -d postgres redis kafka
```

### Stop Infrastructure
```bash
docker-compose down
```

### View Logs
```bash
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f kafka
```

### Check Status
```bash
docker ps
docker-compose ps
```

## 🌐 Nginx Management

### Reload Configuration
```bash
sudo nginx -t          # Test config
sudo systemctl reload nginx
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

### View Logs
```bash
sudo tail -f /var/log/nginx/eventhub-access.log
sudo tail -f /var/log/nginx/eventhub-error.log
```

## 🔍 Health Checks

```bash
# API Gateway
curl http://localhost/health

# Direct service check
curl http://localhost:3000/health
curl http://localhost:3001/health

# External check (from browser)
http://your-server-ip/health
```

## 📊 Port Mapping

| Service | Internal Port | External Access |
|---------|--------------|-----------------|
| Nginx | 80, 443 | Public |
| API Gateway | 3000 | Via Nginx |
| User Service | 3001 | Internal only |
| PostgreSQL | 5432 | Internal only |
| Redis | 6379 | Internal only |
| Kafka | 9092 | Internal only |

## 🔐 Security Checklist

- [ ] Change default database passwords
- [ ] Update JWT secrets in .env files
- [ ] Enable HTTPS with Let's Encrypt
- [ ] Configure firewall (UFW)
- [ ] Set up fail2ban (optional)
- [ ] Regular security updates

## 📝 Common Commands

### Update Code
```bash
cd /var/www/eventhub
git pull
bash setup.sh
pm2 restart all
```

### View All Logs
```bash
pm2 logs &
sudo tail -f /var/log/nginx/*.log &
docker-compose logs -f
```

### Backup Database
```bash
docker exec eventhub-postgres pg_dump -U eventhub eventhub > backup.sql
```

### Restore Database
```bash
cat backup.sql | docker exec -i eventhub-postgres psql -U eventhub eventhub
```

## 🆘 Troubleshooting

### Service Won't Start
```bash
pm2 logs api-gateway --lines 50
pm2 delete api-gateway
pm2 start ecosystem.config.js
```

### Nginx 502 Error
```bash
pm2 status                          # Check if services running
curl http://localhost:3000/health  # Test backend directly
sudo systemctl restart nginx        # Restart Nginx
```

### Database Connection Failed
```bash
docker ps | grep postgres           # Check if running
docker-compose logs postgres        # Check logs
```

### Reset Everything
```bash
pm2 delete all
docker-compose down -v
docker-compose up -d postgres redis kafka
pm2 start ecosystem.config.js
```

## 📞 Quick Support

```bash
# System info
uname -a
node --version
npm --version
docker --version
pm2 --version
nginx -v

# Resource usage
free -h
df -h
htop
```

## 🎯 URLs After Deployment

- API: `http://your-server-ip/api/`
- Health: `http://your-server-ip/health`
- Auth: `http://your-server-ip/api/auth/login`
- Profiles: `http://your-server-ip/api/profiles`

---

For detailed documentation, see: **UBUNTU-DEPLOYMENT.md**
