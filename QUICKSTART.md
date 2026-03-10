# EventHub Backend - Quick Start Guide

This guide will help you get the EventHub backend up and running in 10 minutes.

## Prerequisites Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] Docker and Docker Compose installed (`docker --version`)
- [ ] Git installed

## Step-by-Step Setup

### 1. Clone and Install (2 minutes)

```bash
# Clone the repository
git clone <your-repo-url>
cd eventhub-backend

# Install all dependencies
npm run install:all
```

### 2. Start Infrastructure Services (1 minute)

```bash
# Start PostgreSQL, MongoDB, Redis, Kafka, and MinIO
docker-compose up -d postgres mongodb redis kafka zookeeper minio

# Wait for services to be ready (check status)
docker-compose ps
```

### 3. Configure Environment Variables (2 minutes)

```bash
# User Service
cd services/user-service
cp .env.example .env
cd ../..

# Edit .env files if needed (default values work for local development)
```

### 4. Run Database Migrations (1 minute)

```bash
cd services/user-service
npm run prisma:generate
npm run prisma:migrate
cd ../..
```

### 5. Start Services (2 minutes)

**Option A: Development Mode (Recommended for development)**

Open separate terminal windows for each service:

```bash
# Terminal 1: User Service
npm run dev:user
```

**Option B: Docker Mode (All services)**

```bash
# Build and start all services
docker-compose up --build
```

### 6. Test the API (2 minutes)

```bash
# Health check
curl http://localhost:3001/health

# Register a new user
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "John",
    "lastName": "Doe",
    "role": "GUEST"
  }'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

## Verify Everything is Working

### Check Service Health

```bash
# User Service
curl http://localhost:3001/health

# Expected Response:
# {"status":"healthy","service":"user-service","timestamp":"..."}
```

### Check Infrastructure

```bash
# PostgreSQL
docker exec -it eventhub-postgres psql -U eventhub -d eventhub -c "SELECT version();"

# MongoDB
docker exec -it eventhub-mongodb mongosh -u eventhub -p eventhub123 --eval "db.version()"

# Redis
docker exec -it eventhub-redis redis-cli ping

# Kafka
docker exec -it eventhub-kafka kafka-topics --list --bootstrap-server localhost:9092
```

### Access Web UIs

- MinIO Console: http://localhost:9001
  - Username: `eventhub`
  - Password: `eventhub123`

## Common Issues and Solutions

### Issue: Port Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Issue: Docker Services Not Starting

```bash
# Check logs
docker-compose logs postgres
docker-compose logs kafka

# Restart services
docker-compose restart
```

### Issue: Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Restart PostgreSQL
docker-compose restart postgres

# Check connection
docker exec -it eventhub-postgres psql -U eventhub -d eventhub
```

### Issue: Kafka Connection Failed

Kafka takes ~30 seconds to start. Wait and retry.

```bash
# Check Kafka logs
docker-compose logs -f kafka

# Wait for "started (kafka.server.KafkaServer)"
```

## Next Steps

### 1. Create a Service Provider Account

```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "provider@example.com",
    "password": "Provider123!@#",
    "firstName": "Jane",
    "lastName": "Smith",
    "role": "SERVICE_PROVIDER"
  }'
```

### 2. Explore the API

Use tools like:
- Postman
- Insomnia
- Thunder Client (VS Code extension)
- cURL

Import the API collection from `docs/postman-collection.json` (if available)

### 3. Start Additional Services

```bash
# In separate terminals
npm run dev:profile
npm run dev:catalog
npm run dev:inquiry
npm run dev:payment
npm run dev:review
npm run dev:notification
npm run dev:media
```

### 4. Check Logs

```bash
# Service logs are in logs/ directory
tail -f services/user-service/logs/user-service-combined.log

# Docker logs
docker-compose logs -f user-service
```

## Development Workflow

### Making Changes

1. Edit code in `services/*/src/`
2. Service auto-reloads (in dev mode)
3. Test changes immediately

### Running Tests

```bash
cd services/user-service
npm test
```

### Database Changes

```bash
# 1. Edit Prisma schema
vim services/user-service/prisma/schema.prisma

# 2. Create migration
cd services/user-service
npx prisma migrate dev --name your_migration_name

# 3. Generate client
npm run prisma:generate
```

### Viewing Database

```bash
# Prisma Studio (GUI)
cd services/user-service
npm run prisma:studio
# Opens at http://localhost:5555

# Or use psql
docker exec -it eventhub-postgres psql -U eventhub -d eventhub
```

## Stopping Services

### Stop Development Services

Press `Ctrl+C` in each terminal

### Stop Docker Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (⚠️ deletes all data)
docker-compose down -v
```

## Production Deployment

See `docs/DEPLOYMENT.md` for production deployment guide.

## Need Help?

- 📖 Read the full README.md
- 🐛 Check existing issues
- 💬 Create a new issue
- 📧 Email: dev@eventhub.com

## Quick Reference

### Service Ports

| Service      | Port |
|-------------|------|
| API Gateway | 3000 |
| User        | 3001 |
| Profile     | 3002 |
| Catalog     | 3003 |
| Inquiry     | 3004 |
| Payment     | 3005 |
| Review      | 3006 |
| Notification| 3007 |
| Media       | 3008 |

### Infrastructure Ports

| Service    | Port      |
|-----------|-----------|
| PostgreSQL| 5432      |
| MongoDB   | 27017     |
| Redis     | 6379      |
| Kafka     | 9092      |
| Zookeeper | 2181      |
| MinIO     | 9000,9001 |

### Useful Commands

```bash
# View all running containers
docker-compose ps

# View logs for specific service
docker-compose logs -f user-service

# Rebuild a service
docker-compose up -d --build user-service

# Access container shell
docker exec -it eventhub-user-service sh

# Clean everything
docker-compose down -v
npm run clean (if script exists)
```

Happy coding! 🚀
