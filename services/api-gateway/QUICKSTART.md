# API Gateway - Quick Start Guide

Get the API Gateway running in 5 minutes!

## Prerequisites

- User Service must be running on port 3001
- Redis must be running on port 6379

## Setup Steps

### 1. Navigate to Gateway Directory
```bash
cd services/api-gateway
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment
```bash
# Copy example env file
cp .env.example .env

# Edit .env if needed (defaults work for local dev)
```

### 4. Start the Gateway
```bash
# Development mode (with auto-reload)
npm run dev

# OR Production mode
npm run build
npm start
```

### 5. Verify It's Working
```bash
# In another terminal
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 10.5,
  "services": {
    "user-service": true,
    "profile-service": false,
    ...
  }
}
```

## Test the Gateway

### Run Automated Tests
```bash
# From project root
bash scripts/test-gateway.sh
```

### Manual Testing

#### 1. Register via Gateway
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#",
    "firstName": "John",
    "lastName": "Doe",
    "role": "GUEST"
  }'
```

#### 2. Login via Gateway
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!@#"
  }'
```

#### 3. Access Protected Route
```bash
# Save the access token from login response
TOKEN="your_access_token_here"

curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

## Key Features Enabled

✅ **Routing**: All requests route through gateway
✅ **Authentication**: JWT validation
✅ **Rate Limiting**: 100 requests/min (default)
✅ **Circuit Breaker**: Protects against service failures
✅ **Logging**: Request/response logging with correlation IDs
✅ **Security**: CORS, Helmet, token blacklisting
✅ **Health Monitoring**: Periodic service health checks

## Common Issues

### Issue: Cannot connect to Redis
```bash
# Check if Redis is running
docker ps | grep redis

# Start Redis
docker-compose up -d redis
```

### Issue: Cannot reach User Service
```bash
# Check if User Service is running
curl http://localhost:3001/health

# Start User Service
cd services/user-service
npm run dev
```

### Issue: Rate limit too restrictive
Edit `.env`:
```bash
RATE_LIMIT_MAX_REQUESTS=200  # Increase limit
```

## Architecture at a Glance

```
Client → API Gateway (3000) → Services
                ↓
              Redis
         (cache, rate limit)
```

## Next Steps

1. ✅ Gateway is running
2. Start other services (Profile, Catalog, etc.)
3. Update service URLs in `.env` as you add services
4. Configure production settings (CORS, JWT secret, etc.)
5. Set up monitoring and alerting

## Useful Commands

```bash
# Check all service health
curl http://localhost:3000/services/status

# View logs
tail -f logs/api-gateway-combined.log

# Test rate limiting
for i in {1..10}; do curl http://localhost:3000/health; done

# Monitor circuit breaker
# (Make requests and watch logs for circuit state changes)
```

## Production Deployment

Before deploying to production:

1. Set strong `JWT_SECRET` in environment
2. Configure proper `CORS_ORIGIN`
3. Set service URLs to production endpoints
4. Enable HTTPS/TLS
5. Set up monitoring and alerts
6. Configure appropriate rate limits
7. Review circuit breaker thresholds

## Need Help?

- Check the full README: `services/api-gateway/README.md`
- Run tests: `bash scripts/test-gateway.sh`
- View logs: `logs/api-gateway-combined.log`
- Check service health: `curl http://localhost:3000/services/status`

Happy gateway-ing! 🚀
