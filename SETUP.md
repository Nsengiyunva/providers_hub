# EventHub Backend - UPDATED Quick Start

## ⚠️ IMPORTANT: Setup Order Matters!

The shared packages MUST be built before the services. Follow this exact order:

## Quick Setup (5 minutes)

### Step 1: Run Setup Script (Recommended)
```bash
# This builds shared packages and installs everything
bash setup.sh
```

### Step 2: Start Infrastructure
```bash
docker-compose up -d postgres redis kafka
```

### Step 3: Run Database Migrations
```bash
cd services/user-service
npm run prisma:migrate
cd ../..
```

### Step 4: Start Services
```bash
# Terminal 1: User Service
cd services/user-service
npm run dev

# Terminal 2: API Gateway
cd services/api-gateway  
npm run dev
```

### Step 5: Test
```bash
curl http://localhost:3000/health
bash scripts/test-gateway.sh
```

## Manual Setup (If setup.sh doesn't work)

### 1. Build Shared Packages First
```bash
# MUST be done before services
npm install

# Build shared types
cd shared/types
npm install
npm run build
cd ../..

# Build shared utils
cd shared/utils
npm install
npm run build
cd ../..
```

### 2. Install Service Dependencies
```bash
# User Service
cd services/user-service
npm install
npm run prisma:generate
cd ../..

# API Gateway
cd services/api-gateway
npm install
cd ../..
```

### 3. Start Infrastructure & Services
(Same as above)

## Troubleshooting

### Error: Cannot find module '@eventhub/shared-utils'
```bash
# Solution: Build shared packages first
npm run build:shared
```

### Error: Cannot find module '@prisma/client'
```bash
cd services/user-service
npm run prisma:generate
```

### Full guide: See TROUBLESHOOTING.md

## Project Structure
```
eventhub-backend/
├── shared/              # MUST be built first
│   ├── types/          # Shared TypeScript types
│   └── utils/          # Shared utilities
├── services/           # Build after shared
│   ├── user-service/
│   └── api-gateway/
└── setup.sh            # Run this first!
```

## Key Commands
```bash
# Setup everything
bash setup.sh

# Build only shared packages
npm run build:shared

# Start individual services
npm run dev:user      # User Service
npm run dev:gateway   # API Gateway

# Start infrastructure
docker-compose up -d postgres redis kafka zookeeper

# Run tests
bash scripts/test-api.sh
bash scripts/test-gateway.sh

# View logs
docker-compose logs -f user-service
tail -f services/user-service/logs/user-service-combined.log
```

## Documentation
- **Full README**: README.md (original)
- **Troubleshooting**: TROUBLESHOOTING.md
- **API Gateway**: services/api-gateway/README.md
- **User Service**: Fully implemented
- **Architecture**: docs/ARCHITECTURE.md

## Need Help?
1. Check TROUBLESHOOTING.md
2. Run `bash setup.sh`
3. Verify with `curl http://localhost:3000/health`

Ready to build! 🚀
