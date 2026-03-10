# EventHub - Events Service Platform Backend

A microservices-based backend platform for connecting event service providers with guests. Built with Node.js, TypeScript, Kafka, and modern cloud-native technologies.

## 🏗️ Architecture Overview

### Microservices

1. **API Gateway** (Port 3000)
   - Single entry point for all client requests
   - Request routing and load balancing
   - Rate limiting and authentication
   - Response aggregation

2. **User Service** (Port 3001)
   - User authentication and authorization
   - JWT token management
   - User profile management
   - Role-based access control (RBAC)

3. **Profile Service** (Port 3002)
   - Service provider profile management
   - Business information
   - Gallery management
   - Provider verification

4. **Catalog Service** (Port 3003)
   - Service listings management
   - Package and pricing management
   - Search and filtering
   - Availability management

5. **Inquiry Service** (Port 3004)
   - Inquiry/booking request handling
   - Communication between guests and providers
   - Booking lifecycle management

6. **Payment Service** (Port 3005)
   - Payment processing (Stripe integration)
   - Transaction management
   - Refund handling
   - Invoice generation

7. **Review Service** (Port 3006)
   - Rating and review management
   - Provider response handling
   - Review verification
   - Analytics

8. **Notification Service** (Port 3007)
   - Email notifications
   - SMS notifications
   - Push notifications
   - In-app notifications

9. **Media Service** (Port 3008)
   - Image/video upload
   - Media optimization
   - Cloud storage (S3/MinIO)
   - CDN integration

### Infrastructure Components

- **PostgreSQL**: Primary database for transactional data
- **MongoDB**: Document store for profiles and media metadata
- **Redis**: Caching and session management
- **Kafka**: Event streaming and inter-service communication
- **MinIO**: S3-compatible object storage
- **Docker**: Containerization
- **Kubernetes** (optional): Orchestration

## 📁 Project Structure

```
eventhub-backend/
├── services/                  # Microservices
│   ├── api-gateway/          # API Gateway service
│   ├── user-service/         # User authentication service
│   ├── profile-service/      # Provider profile service
│   ├── catalog-service/      # Service catalog service
│   ├── inquiry-service/      # Inquiry/booking service
│   ├── payment-service/      # Payment processing service
│   ├── review-service/       # Review management service
│   ├── notification-service/ # Notification service
│   └── media-service/        # Media upload service
├── shared/                    # Shared packages
│   ├── types/                # Shared TypeScript types
│   └── utils/                # Shared utilities
├── scripts/                   # Deployment and utility scripts
├── docker-compose.yml        # Docker compose configuration
└── package.json              # Root package.json (monorepo)
```

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+
- MongoDB 7+
- Redis 7+
- Kafka 3.5+

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd eventhub-backend
```

2. **Install dependencies**
```bash
npm run install:all
```

3. **Set up environment variables**
```bash
# Copy environment files for each service
cp services/user-service/.env.example services/user-service/.env
# Repeat for other services
```

4. **Start infrastructure services with Docker**
```bash
docker-compose up -d postgres mongodb redis kafka zookeeper minio
```

5. **Run database migrations**
```bash
cd services/user-service
npm run prisma:migrate
```

6. **Start services in development mode**

Option 1: Start all services individually
```bash
# Terminal 1: User Service
npm run dev:user

# Terminal 2: Profile Service
npm run dev:profile

# Terminal 3: Catalog Service
npm run dev:catalog

# ... and so on
```

Option 2: Use Docker Compose
```bash
docker-compose up --build
```

### Access Services

- API Gateway: http://localhost:3000
- User Service: http://localhost:3001
- Profile Service: http://localhost:3002
- Catalog Service: http://localhost:3003
- MinIO Console: http://localhost:9001 (admin/admin123)
- Kafka UI: http://localhost:8080 (if configured)

## 📝 API Documentation

### User Service API

#### Authentication Endpoints

**POST /api/auth/register**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "role": "GUEST" // or "SERVICE_PROVIDER"
}
```

**POST /api/auth/login**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

Response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "GUEST"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

**POST /api/auth/refresh**
```json
{
  "refreshToken": "your-refresh-token"
}
```

**POST /api/auth/logout**
Headers: `Authorization: Bearer <access-token>`

**POST /api/auth/verify-email**
```json
{
  "token": "verification-token"
}
```

**POST /api/auth/forgot-password**
```json
{
  "email": "user@example.com"
}
```

**POST /api/auth/reset-password**
```json
{
  "token": "reset-token",
  "newPassword": "NewSecurePass123!"
}
```

**GET /api/auth/me**
Headers: `Authorization: Bearer <access-token>`

#### User Management Endpoints

**GET /api/users**
Query params: `page`, `limit`, `search`, `role`, `status`, `sortBy`, `sortOrder`

**GET /api/users/:id**

**PATCH /api/users/:id**
```json
{
  "firstName": "Updated Name",
  "phoneNumber": "+1234567890"
}
```

**DELETE /api/users/:id**

**PATCH /api/users/:id/status** (Admin only)
```json
{
  "status": "ACTIVE" // or "INACTIVE", "SUSPENDED"
}
```

## 🔐 Authentication Flow

1. User registers → receives email verification link
2. User verifies email → account activated
3. User logs in → receives access token (15min) + refresh token (7 days)
4. Client includes access token in Authorization header
5. When access token expires → use refresh token to get new access token
6. User logs out → tokens are revoked and blacklisted

## 📊 Event-Driven Architecture

### Kafka Topics

- `user-events`: User registration, login, profile updates
- `profile-events`: Provider profile creation, updates
- `inquiry-events`: Inquiry creation, responses, status changes
- `booking-events`: Booking confirmations, cancellations
- `payment-events`: Payment processing, refunds
- `review-events`: Review submissions, responses
- `notification-events`: Email, SMS, push notification triggers

### Event Flow Example: New Inquiry

1. Guest creates inquiry → Inquiry Service
2. Inquiry Service → Publishes `INQUIRY_CREATED` event to Kafka
3. Notification Service consumes event → Sends email to provider
4. Profile Service consumes event → Updates provider metrics
5. Inquiry Service stores inquiry in database

## 🗄️ Database Schema

### User Service (PostgreSQL)

```sql
users
- id (UUID, PK)
- email (VARCHAR, UNIQUE)
- password (VARCHAR)
- firstName (VARCHAR)
- lastName (VARCHAR)
- role (ENUM: GUEST, SERVICE_PROVIDER, ADMIN)
- status (ENUM: ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION)
- emailVerified (BOOLEAN)
- phoneNumber (VARCHAR)
- createdAt (TIMESTAMP)
- updatedAt (TIMESTAMP)

refresh_tokens
- id (UUID, PK)
- token (VARCHAR, UNIQUE)
- userId (UUID, FK)
- expiresAt (TIMESTAMP)
- isRevoked (BOOLEAN)

audit_logs
- id (UUID, PK)
- userId (UUID)
- action (VARCHAR)
- resource (VARCHAR)
- resourceId (UUID)
- ipAddress (VARCHAR)
- createdAt (TIMESTAMP)
```

### Profile Service (MongoDB)

```javascript
serviceProviderProfiles
{
  _id: ObjectId,
  userId: String,
  businessName: String,
  category: String,
  description: String,
  location: {
    city: String,
    state: String,
    country: String,
    coordinates: { lat: Number, lng: Number }
  },
  contactInfo: {
    email: String,
    phone: String,
    website: String,
    socialMedia: {}
  },
  servicesOffered: [String],
  gallery: [String], // Media IDs
  verified: Boolean,
  averageRating: Number,
  totalReviews: Number,
  createdAt: Date,
  updatedAt: Date
}
```

## 🛠️ Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

### Building for Production
```bash
npm run build
```

### Database Migrations
```bash
# Create migration
npm run prisma:migrate

# Apply migrations
npx prisma migrate deploy

# Generate Prisma client
npm run prisma:generate
```

## 🔧 Configuration

### Environment Variables

Each service has its own `.env` file. Key variables:

- `NODE_ENV`: development | production
- `PORT`: Service port
- `DATABASE_URL`: PostgreSQL connection string
- `MONGODB_URI`: MongoDB connection string
- `REDIS_URL`: Redis connection string
- `KAFKA_BROKERS`: Kafka broker addresses
- `JWT_SECRET`: Secret key for JWT signing
- `STRIPE_SECRET_KEY`: Stripe API key (Payment Service)
- `SMTP_*`: Email configuration (Notification Service)
- `MINIO_*`: Object storage configuration (Media Service)

## 📈 Monitoring and Observability

### Health Checks

Each service exposes a `/health` endpoint:
```bash
curl http://localhost:3001/health
```

### Logging

- Structured JSON logging with Winston
- Log levels: error, warn, info, debug
- Logs stored in `logs/` directory
- Centralized logging with ELK stack (optional)

### Metrics

- Request/response times
- Error rates
- Service availability
- Kafka message lag
- Database query performance

## 🚢 Deployment

### Docker Deployment

```bash
# Build images
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Kubernetes Deployment

```bash
# Apply configurations
kubectl apply -f k8s/

# Check status
kubectl get pods
kubectl get services

# View logs
kubectl logs -f <pod-name>
```

## 🔒 Security Best Practices

1. **Authentication**
   - JWT with short expiry (15 minutes)
   - Refresh tokens with rotation
   - Token blacklisting on logout

2. **Password Security**
   - Bcrypt hashing (10 rounds)
   - Password strength validation
   - Account lockout after failed attempts

3. **API Security**
   - Rate limiting per endpoint
   - CORS configuration
   - Helmet.js for security headers
   - Input validation with express-validator

4. **Data Protection**
   - Encryption at rest
   - HTTPS/TLS in production
   - Environment variable protection
   - No sensitive data in logs

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Email: support@eventhub.com
- Documentation: https://docs.eventhub.com

## 🗺️ Roadmap

- [ ] Complete all microservices implementation
- [ ] GraphQL API gateway option
- [ ] WebSocket support for real-time notifications
- [ ] Advanced analytics dashboard
- [ ] Mobile app backend support
- [ ] Multi-tenancy support
- [ ] AI-powered service recommendations
- [ ] Payment gateway integrations (PayPal, etc.)
- [ ] Multi-language support
- [ ] Advanced search with Elasticsearch
