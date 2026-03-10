#!/bin/bash

# EventHub Backend - Build Script
# Builds all shared packages and services

set -e

echo "🔨 EventHub Backend Build Script"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
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

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Function to clean build artifacts
clean_build() {
    print_step "Cleaning previous build artifacts..."
    
    # Clean shared packages
    rm -rf shared/types/dist
    rm -rf shared/utils/dist
    
    # Clean services
    rm -rf services/user-service/dist
    rm -rf services/api-gateway/dist
    
    print_success "Build artifacts cleaned"
    echo ""
}

# Function to build shared types
build_types() {
    print_step "Building @eventhub/shared-types..."
    cd shared/types
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies for shared-types..."
        npm install
    fi
    
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Shared types built successfully"
    else
        print_error "Failed to build shared types"
        exit 1
    fi
    
    cd ../..
    echo ""
}

# Function to build shared utils
build_utils() {
    print_step "Building @eventhub/shared-utils..."
    cd shared/utils
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies for shared-utils..."
        npm install
    fi
    
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "Shared utils built successfully"
    else
        print_error "Failed to build shared utils"
        exit 1
    fi
    
    cd ../..
    echo ""
}

# Function to build user service
build_user_service() {
    print_step "Building User Service..."
    cd services/user-service
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies for user-service..."
        npm install
    fi
    
    # Generate Prisma client if not exists
    if [ ! -d "node_modules/.prisma" ]; then
        print_info "Generating Prisma client..."
        npx prisma generate
    fi
    
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "User Service built successfully"
    else
        print_error "Failed to build User Service"
        exit 1
    fi
    
    cd ../..
    echo ""
}

# Function to build API gateway
build_gateway() {
    print_step "Building API Gateway..."
    cd services/api-gateway
    
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies for api-gateway..."
        npm install
    fi
    
    npm run build
    
    if [ $? -eq 0 ]; then
        print_success "API Gateway built successfully"
    else
        print_error "Failed to build API Gateway"
        exit 1
    fi
    
    cd ../..
    echo ""
}

# Main execution
main() {
    # Check if we're in the right directory
    if [ ! -f "package.json" ]; then
        print_error "Please run this script from the eventhub-backend root directory"
        exit 1
    fi
    
    # Parse command line arguments
    CLEAN=false
    BUILD_ALL=true
    BUILD_SHARED_ONLY=false
    
    for arg in "$@"; do
        case $arg in
            --clean)
                CLEAN=true
                shift
                ;;
            --shared-only)
                BUILD_SHARED_ONLY=true
                BUILD_ALL=false
                shift
                ;;
            --help)
                echo "Usage: ./build.sh [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --clean         Clean build artifacts before building"
                echo "  --shared-only   Build only shared packages (types and utils)"
                echo "  --help          Show this help message"
                echo ""
                echo "Examples:"
                echo "  ./build.sh                # Build everything"
                echo "  ./build.sh --clean        # Clean and build everything"
                echo "  ./build.sh --shared-only  # Build only shared packages"
                exit 0
                ;;
        esac
    done
    
    # Clean if requested
    if [ "$CLEAN" = true ]; then
        clean_build
    fi
    
    # Build shared packages (always)
    build_types
    build_utils
    
    # Build services if not shared-only
    if [ "$BUILD_ALL" = true ]; then
        build_user_service
        build_gateway
    fi
    
    echo "=================================="
    echo -e "${GREEN}✓ Build completed successfully!${NC}"
    echo ""
    
    if [ "$BUILD_SHARED_ONLY" = true ]; then
        echo "Next steps:"
        echo "1. Build services: cd services/user-service && npm run build"
        echo "2. Or run services in dev mode: npm run dev:user"
    else
        echo "Next steps:"
        echo "1. Start infrastructure: docker-compose up -d postgres redis kafka"
        echo "2. Run migrations: cd services/user-service && npm run prisma:migrate"
        echo "3. Start services:"
        echo "   - User Service: cd services/user-service && npm start"
        echo "   - API Gateway: cd services/api-gateway && npm start"
    fi
    echo ""
}

# Run main function
main "$@"
