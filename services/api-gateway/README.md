# API Gateway Service

The API Gateway serves as the single entry point for all client requests to the EventHub microservices backend.

## Features

### 🔐 Security
- **JWT Authentication**: Validates access tokens and forwards user context to downstream services
- **Token Blacklisting**: Checks Redis for revoked tokens
- **Rate Limiting**: Configurable per-endpoint rate limits to prevent abuse
- **CORS Protection**: Configurable allowed origins
- **Security Headers**: Helmet.js for security best practices

### 🔄 Resilience
- **Circuit Breaker**: Prevents cascading failures by opening circuit after threshold failures
- **Health Monitoring**: Periodic health checks of all downstream services
- **Service Registry**: Dynamic service discovery and URL management
- **Graceful Degradation**: Returns meaningful errors when services are unavailable

### 📊 Observability
- **Request Logging**: Structured logging with correlation IDs
- **Request/Response Tracking**: Duration, status codes, paths
- **Health Endpoints**: Gateway and service health status
- **Rate Limit Headers**: X-RateLimit-* headers for client awareness

### 🚦 Routing
- **Intelligent Routing**: Routes requests to appropriate microservices
- **Path Rewriting**: Normalizes paths before forwarding
- **Header Injection**: Adds user context headers (x-user-id, x-user-role, etc.)
- **Error Handling**: Consistent error responses across all services

## Architecture

```
Client Request
     │
     ▼
┌─────────────────────┐
│   Rate Limiter      │ ← Redis
├─────────────────────┤
│   Authentication    │ ← JWT Validation, Redis (blacklist)
├─────────────────────┤
│  Circuit Breaker    │ ← Redis (state tracking)
├─────────────────────┤
│   Request Logger    │ ← Correlation ID
├─────────────────────┤
│   Proxy Middleware  │
└──────────┬──────────┘
           │
           ▼
  ┌────────────────┐
  │ Service Router │
  └────────┬───────┘
           │
     ┌─────┴─────┬─────────┬─────────┐
     ▼           ▼         ▼         ▼
┌─────────┐ ┌──────────┐ ┌──────┐ ┌────────┐
│  User   │ │ Profile  │ │ ...  │ │ Media  │
│ Service │ │ Service  │ │      │ │Service │
└─────────┘ └──────────┘ └──────┘ └────────┘
```

## API Routes

### Public Routes (No Authentication Required)

#### Authentication
```
POST   /api/auth/register          → User Service
POST   /api/auth/login             → User Service
POST   /api/auth/verify-email      → User Service
POST   /api/auth/forgot-password   → User Service
POST   /api/auth/reset-password    → User Service
```

#### Browse (Read-Only)
```
GET    /api/profiles               → Profile Service
GET    /api/profiles/:id           → Profile Service
GET    /api/catalog                → Catalog Service
GET    /api/catalog/:id            → Catalog Service
GET    /api/reviews                → Review Service
GET    /api/reviews/:id            → Review Service
```

### Protected Routes (Authentication Required)

#### User Management
```
GET    /api/auth/me                → User Service
POST   /api/auth/logout            → User Service
POST   /api/auth/refresh           → User Service
POST   /api/auth/change-password   → User Service
GET    /api/users                  → User Service (Admin only)
GET    /api/users/:id              → User Service
PATCH  /api/users/:id              → User Service
DELETE /api/users/:id              → User Service
```

#### Profile Management
```
POST   /api/profiles               → Profile Service
PATCH  /api/profiles/:id           → Profile Service
DELETE /api/profiles/:id           → Profile Service
```

#### Inquiries & Bookings
```
GET    /api/inquiries              → Inquiry Service
POST   /api/inquiries              → Inquiry Service
GET    /api/inquiries/:id          → Inquiry Service
PATCH  /api/inquiries/:id          → Inquiry Service
GET    /api/bookings               → Inquiry Service
GET    /api/bookings/:id           → Inquiry Service
PATCH  /api/bookings/:id           → Inquiry Service
```

#### Payments
```
POST   /api/payments               → Payment Service
GET    /api/payments/:id           → Payment Service
POST   /api/payments/:id/refund    → Payment Service
```

#### Media Upload
```
POST   /api/media/upload           → Media Service
GET    /api/media/:id              → Media Service
DELETE /api/media/:id              → Media Service
```

#### Reviews
```
POST   /api/reviews                → Review Service
PATCH  /api/reviews/:id            → Review Service
DELETE /api/reviews/:id            → Review Service
```

#### Notifications
```
GET    /api/notifications          → Notification Service
PATCH  /api/notifications/:id/read → Notification Service
```

### Gateway Management Routes

```
GET    /health                     → Gateway health
GET    /version                    → API version info
GET    /services/status            → All services health
```

## Rate Limiting

Different endpoints have different rate limits:

| Endpoint Pattern | Window | Max Requests |
|-----------------|--------|--------------|
| /api/auth/login | 15 min | 5 |
| /api/auth/register | 1 hour | 3 |
| /api/auth/forgot-password | 1 hour | 3 |
| /api/payments/* | 1 min | 10 |
| Default | 1 min | 100 |

Rate limit information is included in response headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2024-01-15T10:30:00.000Z
```

## Circuit Breaker

The circuit breaker protects against cascading failures:

### States
1. **CLOSED** (Normal): All requests pass through
2. **OPEN** (Failing): Requests are rejected immediately
3. **HALF_OPEN** (Testing): Limited requests allowed to test recovery

### Configuration
- **Failure Threshold**: 5 consecutive failures
- **Reset Timeout**: 60 seconds
- **Half-Open Requests**: 3 test requests

### Behavior
```
Service failures → Circuit OPEN (503 responses)
                       ↓
                  Wait 60 seconds
                       ↓
              Circuit HALF_OPEN (allow 3 requests)
                       ↓
            ┌──────────┴──────────┐
            ▼                     ▼
      Success (3/3)         Failure (any)
            │                     │
            ▼                     ▼
    Circuit CLOSED         Circuit OPEN
```

## Authentication Flow

### 1. Client Login
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "success": true,
  "data": {
    "user": {...},
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    }
  }
}
```

### 2. Authenticated Request
```bash
GET /api/users/me
Authorization: Bearer eyJhbGc...

Gateway adds headers:
X-User-ID: 123e4567-e89b-12d3-a456-426614174000
X-User-Email: user@example.com
X-User-Role: GUEST
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

### 3. Service Receives
The downstream service receives the request with user context in headers.

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "correlationId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Common Error Codes
- `UNAUTHORIZED` (401): Invalid or missing token
- `FORBIDDEN` (403): Insufficient permissions
- `NOT_FOUND` (404): Endpoint not found
- `TOO_MANY_REQUESTS` (429): Rate limit exceeded
- `SERVICE_UNAVAILABLE` (503): Circuit breaker open or service down
- `INTERNAL_SERVER_ERROR` (500): Unexpected error

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=production

# Redis (for caching, rate limiting, circuit breaker)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key

# CORS
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# Service URLs
USER_SERVICE_URL=http://user-service:3001
PROFILE_SERVICE_URL=http://profile-service:3002
# ... etc
```

### Service Registry

Services are registered in `src/config/service-registry.ts`:

```typescript
{
  name: 'user-service',
  url: process.env.USER_SERVICE_URL || 'http://user-service:3001',
  healthEndpoint: '/health',
  timeout: 5000,
  retries: 3
}
```

## Running the Gateway

### Development
```bash
cd services/api-gateway
npm install
npm run dev
```

### Production
```bash
npm run build
npm start
```

### Docker
```bash
docker build -t eventhub/api-gateway .
docker run -p 3000:3000 eventhub/api-gateway
```

## Health Monitoring

### Check Gateway Health
```bash
curl http://localhost:3000/health
```

Response:
```json
{
  "status": "healthy",
  "service": "api-gateway",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600,
  "services": {
    "user-service": true,
    "profile-service": true,
    "catalog-service": false,
    ...
  }
}
```

### Check All Services
```bash
curl http://localhost:3000/services/status
```

## Monitoring & Logging

### Correlation IDs
Every request gets a unique correlation ID for tracing:

```
Request → Gateway (generate ID) → Service A → Service B
         all use same correlation ID
```

### Log Format
```json
{
  "level": "info",
  "message": "Incoming request",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "method": "GET",
  "path": "/api/users/me",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## Performance

### Caching Strategy
- Rate limit counters: Redis with TTL
- Circuit breaker state: Redis with 5-min TTL
- Token blacklist: Redis with token expiry TTL

### Optimization Tips
1. Use Redis connection pooling
2. Enable HTTP keep-alive
3. Set appropriate timeouts
4. Monitor circuit breaker thresholds
5. Adjust rate limits based on load

## Security Considerations

### Production Checklist
- ✅ Use HTTPS/TLS
- ✅ Set strong JWT secrets
- ✅ Configure CORS properly
- ✅ Enable rate limiting
- ✅ Use Helmet.js
- ✅ Monitor for anomalies
- ✅ Rotate secrets regularly
- ✅ Use environment variables
- ✅ Enable audit logging
- ✅ Implement IP whitelisting (if needed)

## Troubleshooting

### Issue: 503 Service Unavailable
**Cause**: Circuit breaker is OPEN
**Solution**: 
1. Check downstream service health
2. Wait for circuit to transition to HALF_OPEN (60s)
3. Fix underlying service issue

### Issue: 429 Too Many Requests
**Cause**: Rate limit exceeded
**Solution**:
1. Check X-RateLimit-Reset header
2. Implement exponential backoff
3. Request rate limit increase if legitimate

### Issue: Service not responding
**Cause**: Service registry has wrong URL
**Solution**:
1. Check environment variables
2. Verify service is running
3. Check network connectivity

## Testing

### Manual Testing
```bash
# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test authenticated endpoint
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test rate limiting
for i in {1..10}; do
  curl http://localhost:3000/api/auth/me
done
```

### Load Testing
```bash
# Using Apache Bench
ab -n 1000 -c 10 http://localhost:3000/health

# Using k6
k6 run load-test.js
```

## Contributing

When adding new routes:
1. Add service to `service-registry.ts`
2. Add proxy configuration in `index.ts`
3. Configure rate limits if needed
4. Update this documentation
5. Add tests

## License

MIT
