#!/bin/bash

# EventHub Backend Setup Script
# This script builds shared packages and installs all dependencies

set -e

echo "🚀 EventHub Backend Setup"
echo "========================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Please run this script from the eventhub-backend root directory"
    exit 1
fi

# Step 1: Install root dependencies
print_step "Installing root dependencies..."
npm install
print_success "Root dependencies installed"
echo ""

# Step 2: Build shared types
print_step "Building shared types package..."
cd shared/types
npm install
npm run build
cd ../..
print_success "Shared types built"
echo ""

# Step 3: Build shared utils
print_step "Building shared utils package..."
cd shared/utils
npm install
npm run build
cd ../..
print_success "Shared utils built"
echo ""

# Step 4: Install User Service dependencies
print_step "Installing User Service dependencies..."
cd services/user-service
npm install
print_success "User Service dependencies installed"
cd ../..
echo ""

# Step 5: Install API Gateway dependencies
print_step "Installing API Gateway dependencies..."
cd services/api-gateway
npm install
print_success "API Gateway dependencies installed"
cd ../..
echo ""

# Step 6: Generate Prisma client for User Service
print_step "Generating Prisma client for User Service..."
cd services/user-service
npx prisma generate
print_success "Prisma client generated"
cd ../..
echo ""

echo "========================="
echo -e "${GREEN}✓ Setup completed successfully!${NC}"
echo ""
echo "Next steps:"
echo "1. Start infrastructure: docker-compose up -d postgres mongodb redis kafka minio"
echo "2. Run migrations: cd services/user-service && npm run prisma:migrate"
echo "3. Start User Service: cd services/user-service && npm run dev"
echo "4. Start API Gateway: cd services/api-gateway && npm run dev"
echo ""
echo "Happy coding! 🚀"
