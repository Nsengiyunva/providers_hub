# Troubleshooting Guide - EventHub Backend

## Common Setup Issues

### Issue 1: Cannot find module '@eventhub/shared-utils' or '@eventhub/shared-types'

**Error:**
```
Cannot find module '@eventhub/shared-utils' or its corresponding type declarations
```

**Cause:** Shared packages haven't been built yet.

**Solution:**

**Option 1: Use the setup script (Recommended)**
```bash
# From the project root
bash setup.sh
```

**Option 2: Manual setup**
```bash
# 1. Install root dependencies
npm install

# 2. Build shared types
cd shared/types
npm install
npm run build
cd ../..

# 3. Build shared utils
cd shared/utils
npm install
npm run build
cd ../..

# 4. Install service dependencies
cd services/user-service
npm install
cd ../..

cd services/api-gateway
npm install
cd ../..
```

**Option 3: Build shared packages only**
```bash
npm run build:shared
```

### Issue 2: Prisma client not generated

**Error:**
```
Cannot find module '@prisma/client'
```

**Solution:**
```bash
cd services/user-service
npm run prisma:generate
```

### Issue 3: TypeScript compilation errors

**Error:**
```
TS2307: Cannot find module or its corresponding type declarations
```

**Solution:**
```bash
# Make sure shared packages are built first
npm run build:shared

# Then rebuild the service
cd services/user-service
npm run build
```

### Issue 4: Redis connection failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:6379
```

**Solution:**
```bash
# Start Redis with Docker
docker-compose up -d redis

# Verify Redis is running
docker ps | grep redis

# Test connection
docker exec -it eventhub-redis redis-cli ping
# Should return: PONG
```

### Issue 5: PostgreSQL connection failed

**Error:**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
```bash
# Start PostgreSQL with Docker
docker-compose up -d postgres

# Verify PostgreSQL is running
docker ps | grep postgres

# Test connection
docker exec -it eventhub-postgres psql -U eventhub -d eventhub -c "SELECT version();"
```

### Issue 6: Kafka connection timeout

**Error:**
```
KafkaJSConnectionError: Connection timeout
```

**Solution:**
```bash
# Kafka takes 30-60 seconds to start (KRaft formatting on first run)
docker-compose up -d kafka

# Wait for Kafka to be ready (look for "Kafka Server started")
docker-compose logs -f kafka

# Check Kafka is running
docker ps | grep kafka

# Test connection
docker exec -it eventhub-kafka \
  kafka-broker-api-versions --bootstrap-server localhost:9092
```

### Issue 7: Port already in use

**Error:**
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Solution:**
```bash
# Find process using the port
lsof -i :3001

# Kill the process
kill -9 <PID>

# Or use a different port by editing .env
PORT=3011
```

### Issue 8: npm install fails with workspace errors

**Error:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solution:**
```bash
# Clear npm cache
npm cache clean --force

# Delete all node_modules and package-lock.json
rm -rf node_modules
rm -rf shared/*/node_modules
rm -rf services/*/node_modules
rm package-lock.json

# Reinstall
npm install
```

### Issue 9: Docker container won't start

**Error:**
```
Error response from daemon: driver failed programming external connectivity
```

**Solution:**
```bash
# Stop all containers
docker-compose down

# Remove all containers and volumes
docker-compose down -v

# Restart Docker daemon
# On Mac/Windows: Restart Docker Desktop
# On Linux:
sudo systemctl restart docker

# Start again
docker-compose up -d
```

### Issue 10: Missing environment variables

**Error:**
```
JWT_SECRET is not defined
```

**Solution:**
```bash
# Copy example env files
cd services/user-service
cp .env.example .env

cd ../api-gateway
cp .env.example .env
```

## Development Workflow Issues

### Issue 11: Changes not reflecting (TypeScript)

**Problem:** Code changes don't take effect

**Solution:**
```bash
# For shared packages, rebuild after changes
cd shared/utils
npm run build
cd ../..

# Services will auto-reload if using ts-node-dev
# Otherwise restart the service
```

### Issue 12: Database schema changes

**Problem:** Need to update database schema

**Solution:**
```bash
cd services/user-service

# Edit prisma/schema.prisma
# Then create migration
npx prisma migrate dev --name your_migration_name

# Generate new client
npm run prisma:generate
```

### Issue 13: Viewing database data

**Solution:**
```bash
# Option 1: Prisma Studio (GUI)
cd services/user-service
npx prisma studio
# Opens at http://localhost:5555

# Option 2: Direct psql
docker exec -it eventhub-postgres psql -U eventhub -d eventhub

# Common queries
\dt                    # List tables
\d users              # Describe users table
SELECT * FROM users;  # Query users
```

### Issue 14: Kafka messages not flowing

**Problem:** Events published but not consumed

**Solution:**
```bash
# Check Kafka topics
docker exec -it eventhub-kafka \
  kafka-topics --list --bootstrap-server localhost:9092

# Check consumer groups
docker exec -it eventhub-kafka \
  kafka-consumer-groups --list --bootstrap-server localhost:9092

# Check logs
docker-compose logs -f kafka
docker-compose logs -f user-service
```

## Testing Issues

### Issue 15: Tests failing

**Problem:** API tests return unexpected results

**Solution:**
```bash
# Make sure all services are running
curl http://localhost:3001/health  # User Service
curl http://localhost:3000/health  # API Gateway

# Check logs for errors
tail -f services/user-service/logs/user-service-error.log

# Run tests with verbose output
bash scripts/test-api.sh
```

## Quick Diagnostic Commands

### Check Everything
```bash
# Services
curl http://localhost:3000/health  # API Gateway
curl http://localhost:3001/health  # User Service

# Infrastructure
docker ps  # All containers

# Databases
docker exec -it eventhub-postgres psql -U eventhub -d eventhub -c "SELECT 1;"
docker exec -it eventhub-redis redis-cli ping
docker exec -it eventhub-mongodb mongosh -u eventhub -p eventhub123 --eval "db.version()"

# Kafka
docker exec -it eventhub-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Full System Status
```bash
#!/bin/bash
echo "=== EventHub System Status ==="
echo ""
echo "Services:"
curl -s http://localhost:3000/health | grep -o '"status":"[^"]*"' || echo "Gateway: DOWN"
curl -s http://localhost:3001/health | grep -o '"status":"[^"]*"' || echo "User Service: DOWN"
echo ""
echo "Infrastructure:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep eventhub
```

## Getting Help

### Collect Information
When asking for help, provide:

1. **Error message** (full stack trace)
2. **Steps to reproduce**
3. **Environment:**
   ```bash
   node --version
   npm --version
   docker --version
   docker-compose --version
   ```
4. **Logs:**
   ```bash
   docker-compose logs user-service
   tail -n 50 services/user-service/logs/user-service-error.log
   ```
5. **Configuration:**
   ```bash
   cat services/user-service/.env | grep -v SECRET
   ```

### Common Log Locations
- Service logs: `services/*/logs/*.log`
- Docker logs: `docker-compose logs <service-name>`
- System logs: Check Docker Desktop logs

### Reset Everything
If all else fails, nuclear option:

```bash
# Stop everything
docker-compose down -v

# Clean all generated files
rm -rf node_modules
rm -rf shared/*/node_modules
rm -rf shared/*/dist
rm -rf services/*/node_modules
rm -rf services/*/dist
rm package-lock.json

# Start fresh
bash setup.sh
docker-compose up -d postgres redis kafka zookeeper
cd services/user-service && npm run prisma:migrate
```

## Still Having Issues?

1. Check the full README.md
2. Review QUICKSTART.md
3. Check existing GitHub issues
4. Create a new issue with:
   - Error message
   - Steps to reproduce
   - Environment details
   - Relevant logs

## Prevention Tips

1. **Always run setup.sh first** after cloning
2. **Build shared packages** before services
3. **Check Docker** containers are running
4. **Wait for Kafka** to fully start (30-60s)
5. **Use the test scripts** to verify setup
6. **Check logs early** when things fail
7. **Keep dependencies updated** regularly

Happy debugging! 🔧
