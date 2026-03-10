# EventHub Backend Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Web App  │  │ Mobile   │  │ Admin    │  │ External │        │
│  │ (React)  │  │   App    │  │  Panel   │  │   APIs   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘        │
│       │             │             │             │                │
└───────┼─────────────┼─────────────┼─────────────┼────────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                      │
        ┌─────────────▼─────────────┐
        │      API Gateway          │
        │    (Port 3000)            │
        │  - Routing                │
        │  - Rate Limiting          │
        │  - Authentication         │
        │  - Load Balancing         │
        └─────────────┬─────────────┘
                      │
        ┌─────────────┴─────────────────────────────────┐
        │              Service Mesh                      │
        │                                               │
┌───────▼────────┐ ┌───────────┐ ┌───────────┐ ┌──────▼──────┐
│  User Service  │ │  Profile  │ │  Catalog  │ │   Inquiry   │
│  (Port 3001)   │ │  Service  │ │  Service  │ │   Service   │
│                │ │ (Port     │ │ (Port     │ │  (Port      │
│ - Auth         │ │  3002)    │ │  3003)    │ │   3004)     │
│ - Users        │ │           │ │           │ │             │
│ - Tokens       │ │ - Provider│ │ - Listings│ │ - Bookings  │
│ - Sessions     │ │   Profiles│ │ - Packages│ │ - Messages  │
└───────┬────────┘ └─────┬─────┘ └─────┬─────┘ └──────┬──────┘
        │                │             │              │
┌───────▼────────┐ ┌─────▼─────┐ ┌────▼──────┐ ┌─────▼───────┐
│    Payment     │ │  Review   │ │Notification│ │    Media    │
│    Service     │ │  Service  │ │  Service   │ │   Service   │
│  (Port 3005)   │ │ (Port     │ │ (Port      │ │  (Port      │
│                │ │  3006)    │ │  3007)     │ │   3008)     │
│ - Stripe       │ │           │ │            │ │             │
│ - Transactions │ │ - Ratings │ │ - Email    │ │ - Upload    │
│ - Refunds      │ │ - Reviews │ │ - SMS      │ │ - Storage   │
└───────┬────────┘ └─────┬─────┘ └─────┬──────┘ └──────┬──────┘
        │                │             │              │
        └────────────────┴─────────────┴──────────────┘
                         │
        ┌────────────────▼────────────────┐
        │      Event Bus (Kafka)          │
        │                                 │
        │  Topics:                        │
        │  - user-events                  │
        │  - profile-events               │
        │  - inquiry-events               │
        │  - booking-events               │
        │  - payment-events               │
        │  - review-events                │
        │  - notification-events          │
        └────────────────┬────────────────┘
                         │
        ┌────────────────┴────────────────┐
        │         Data Layer              │
        │                                 │
┌───────▼────────┐ ┌───────────┐ ┌───────▼───────┐
│   PostgreSQL   │ │  MongoDB  │ │     Redis     │
│                │ │           │ │               │
│ - Users        │ │ - Profiles│ │ - Cache       │
│ - Bookings     │ │ - Media   │ │ - Sessions    │
│ - Payments     │ │ - Notifs  │ │ - Rate Limit  │
│ - Reviews      │ │           │ │ - Queues      │
└────────────────┘ └───────────┘ └───────────────┘
                         │
                ┌────────▼────────┐
                │  MinIO (S3)     │
                │                 │
                │ - Images        │
                │ - Videos        │
                │ - Documents     │
                └─────────────────┘
```

## Service Communication Patterns

### 1. Synchronous Communication (REST)
- Client → API Gateway → Services
- Service → Service (when immediate response needed)
- Used for: User queries, real-time operations

### 2. Asynchronous Communication (Kafka)
- Service → Kafka → Service(s)
- Used for: Events, notifications, data synchronization
- Guarantees eventual consistency

### 3. Cache-Aside Pattern (Redis)
```
1. Check Redis cache
2. If miss → Query database
3. Store in cache
4. Return result
```

## Event Flow Examples

### User Registration Flow

```
1. Client → API Gateway → User Service
   POST /api/auth/register

2. User Service:
   - Validates input
   - Hashes password
   - Creates user in PostgreSQL
   - Publishes USER_CREATED event to Kafka

3. Kafka → Consumers:
   - Notification Service: Send welcome email
   - Profile Service: Create empty profile (if provider)
   - Analytics Service: Track registration

4. Response to Client:
   - User data
   - Success message
```

### Booking Flow

```
1. Guest creates inquiry
   Client → Inquiry Service

2. Inquiry Service:
   - Validates data
   - Stores in PostgreSQL
   - Publishes INQUIRY_CREATED event

3. Event Consumers:
   - Notification Service: Email provider
   - Profile Service: Update inquiry count

4. Provider responds
   Provider → Inquiry Service

5. Guest accepts quote
   Guest → Inquiry Service → Booking confirmed

6. Booking Service:
   - Publishes BOOKING_CONFIRMED event
   - Notification Service: Emails both parties
   - Payment Service: Initiates payment

7. Payment processed
   Payment Service → Publishes PAYMENT_SUCCEEDED
   - Booking Service: Updates status
   - Notification Service: Confirmation emails
```

### Review Flow

```
1. Guest submits review (after completed booking)
   Client → Review Service

2. Review Service:
   - Validates booking completion
   - Stores review in PostgreSQL
   - Publishes REVIEW_CREATED event

3. Event Consumers:
   - Profile Service: Updates provider rating
   - Notification Service: Emails provider
   - Analytics Service: Updates metrics

4. Provider responds (optional)
   Provider → Review Service
   - Update review with response
   - Publish REVIEW_RESPONSE event
   - Notification Service: Email guest
```

## Data Models

### User Service (PostgreSQL)

```sql
User {
  id: UUID (PK)
  email: VARCHAR
  password: VARCHAR (hashed)
  firstName: VARCHAR
  lastName: VARCHAR
  role: ENUM (GUEST, SERVICE_PROVIDER, ADMIN)
  status: ENUM (ACTIVE, INACTIVE, SUSPENDED, PENDING)
  emailVerified: BOOLEAN
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}

RefreshToken {
  id: UUID (PK)
  token: VARCHAR
  userId: UUID (FK → User)
  expiresAt: TIMESTAMP
  isRevoked: BOOLEAN
}
```

### Profile Service (MongoDB)

```javascript
ServiceProviderProfile {
  _id: ObjectId
  userId: String (ref: User.id)
  businessName: String
  category: String
  description: String
  location: {
    city: String
    state: String
    country: String
    coordinates: { lat: Number, lng: Number }
  }
  contactInfo: {
    email: String
    phone: String
    website: String
  }
  gallery: [String] // Media IDs
  averageRating: Number
  totalReviews: Number
  verified: Boolean
  createdAt: Date
  updatedAt: Date
}
```

### Catalog Service (PostgreSQL)

```sql
ServiceListing {
  id: UUID (PK)
  providerId: UUID (FK)
  title: VARCHAR
  description: TEXT
  category: VARCHAR
  pricingType: ENUM (FIXED, HOURLY, PACKAGE, CUSTOM)
  basePrice: DECIMAL
  currency: VARCHAR
  active: BOOLEAN
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}

ServicePackage {
  id: UUID (PK)
  listingId: UUID (FK)
  name: VARCHAR
  description: TEXT
  price: DECIMAL
  duration: INTEGER
  features: JSONB
}
```

### Inquiry/Booking Service (PostgreSQL)

```sql
Inquiry {
  id: UUID (PK)
  guestId: UUID (FK)
  providerId: UUID (FK)
  serviceListingId: UUID (FK)
  eventType: VARCHAR
  eventDate: DATE
  eventLocation: VARCHAR
  numberOfGuests: INTEGER
  message: TEXT
  status: ENUM (PENDING, RESPONDED, ACCEPTED, DECLINED)
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}

Booking {
  id: UUID (PK)
  inquiryId: UUID (FK)
  guestId: UUID (FK)
  providerId: UUID (FK)
  status: ENUM (PENDING, CONFIRMED, COMPLETED, CANCELLED)
  totalAmount: DECIMAL
  paymentStatus: VARCHAR
  eventDate: DATE
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

### Review Service (PostgreSQL)

```sql
Review {
  id: UUID (PK)
  bookingId: UUID (FK)
  providerId: UUID (FK)
  guestId: UUID (FK)
  rating: INTEGER (1-5)
  title: VARCHAR
  comment: TEXT
  photos: JSONB
  verified: BOOLEAN
  createdAt: TIMESTAMP
  updatedAt: TIMESTAMP
}
```

## Scalability Considerations

### Horizontal Scaling
- Each service can be scaled independently
- Load balancer distributes traffic
- Stateless services (session in Redis)

### Database Scaling
- **PostgreSQL**: Read replicas for queries
- **MongoDB**: Sharding for large datasets
- **Redis**: Redis Cluster for high availability

### Caching Strategy
- **L1 Cache**: Application memory
- **L2 Cache**: Redis (shared)
- **CDN**: Static assets, images

### Message Queue
- Kafka partitions for parallel processing
- Consumer groups for load distribution
- Dead letter queues for failed messages

## Security Architecture

### Authentication Flow
```
1. User logs in → User Service
2. User Service validates credentials
3. Generate JWT (access + refresh tokens)
4. Store refresh token in database
5. Return tokens to client
6. Client stores in secure storage
7. Include access token in API requests
8. Services validate token (JWT signature)
9. Token expires → Use refresh token
10. Logout → Revoke tokens
```

### Authorization Levels
- **Guest**: Basic read, create inquiries
- **Service Provider**: Manage profile, respond to inquiries
- **Admin**: Full system access

### Data Protection
- Passwords: Bcrypt hashing
- Tokens: JWT with short expiry
- API: Rate limiting per IP/user
- Database: Encrypted at rest
- Communication: TLS/HTTPS

## Monitoring and Observability

### Metrics
- Request rate per service
- Response time (p50, p95, p99)
- Error rate
- Database query time
- Kafka lag
- Cache hit ratio

### Logging
- Structured JSON logs
- Log levels: ERROR, WARN, INFO, DEBUG
- Correlation IDs for tracing
- Centralized logging (ELK stack)

### Health Checks
- `/health` endpoint per service
- Database connectivity
- Kafka connectivity
- Redis connectivity

### Alerts
- High error rate
- Slow response time
- Database connection issues
- Kafka consumer lag
- High memory/CPU usage

## Disaster Recovery

### Backup Strategy
- **PostgreSQL**: Daily full backup, hourly incremental
- **MongoDB**: Daily backup to S3
- **Redis**: RDB snapshots + AOF
- **Media**: S3 versioning enabled

### Recovery Time Objective (RTO)
- Critical services: < 15 minutes
- Non-critical services: < 1 hour
- Database: < 30 minutes

### Recovery Point Objective (RPO)
- Transactional data: < 5 minutes
- Media files: < 1 hour
- Analytics data: < 1 day
