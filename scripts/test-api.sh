#!/bin/bash

# EventHub API Testing Script
# This script tests the User Service API endpoints

set -e

BASE_URL="http://localhost:3001"
CONTENT_TYPE="Content-Type: application/json"

echo "🧪 EventHub API Testing Script"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to print test result
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" $BASE_URL/health)
[ "$RESPONSE" -eq 200 ]
print_result $? "Health endpoint returns 200"
echo ""

# Test 2: Register Guest User
echo -e "${YELLOW}Test 2: Register Guest User${NC}"
GUEST_EMAIL="guest_$(date +%s)@test.com"
REGISTER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$GUEST_EMAIL\",
    \"password\": \"GuestPass123!\",
    \"firstName\": \"Test\",
    \"lastName\": \"Guest\",
    \"role\": \"GUEST\"
  }")

echo "$REGISTER_RESPONSE" | grep -q "success.*true"
print_result $? "Guest user registration successful"
echo ""

# Test 3: Register Service Provider
echo -e "${YELLOW}Test 3: Register Service Provider${NC}"
PROVIDER_EMAIL="provider_$(date +%s)@test.com"
PROVIDER_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$PROVIDER_EMAIL\",
    \"password\": \"ProviderPass123!\",
    \"firstName\": \"Test\",
    \"lastName\": \"Provider\",
    \"role\": \"SERVICE_PROVIDER\"
  }")

echo "$PROVIDER_RESPONSE" | grep -q "success.*true"
print_result $? "Service provider registration successful"
echo ""

# Test 4: Login with Guest
echo -e "${YELLOW}Test 4: Login as Guest${NC}"
LOGIN_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/login \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$GUEST_EMAIL\",
    \"password\": \"GuestPass123!\"
  }")

echo "$LOGIN_RESPONSE" | grep -q "accessToken"
print_result $? "Guest login successful and received tokens"

# Extract access token
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
echo "Access Token: ${ACCESS_TOKEN:0:20}..."
echo ""

# Test 5: Get Current User
echo -e "${YELLOW}Test 5: Get Current User (Authenticated)${NC}"
ME_RESPONSE=$(curl -s -X GET $BASE_URL/api/auth/me \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$ME_RESPONSE" | grep -q "$GUEST_EMAIL"
print_result $? "Successfully retrieved current user information"
echo ""

# Test 6: Invalid Login
echo -e "${YELLOW}Test 6: Invalid Login (Wrong Password)${NC}"
INVALID_LOGIN=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE_URL/api/auth/login \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$GUEST_EMAIL\",
    \"password\": \"WrongPassword\"
  }")

[ "$INVALID_LOGIN" -eq 401 ]
print_result $? "Invalid login returns 401"
echo ""

# Test 7: Weak Password
echo -e "${YELLOW}Test 7: Register with Weak Password${NC}"
WEAK_PASS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"weak_$(date +%s)@test.com\",
    \"password\": \"weak\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"role\": \"GUEST\"
  }")

[ "$WEAK_PASS_RESPONSE" -eq 400 ]
print_result $? "Weak password rejected with 400"
echo ""

# Test 8: Duplicate Email
echo -e "${YELLOW}Test 8: Register with Duplicate Email${NC}"
DUPLICATE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X POST $BASE_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$GUEST_EMAIL\",
    \"password\": \"AnotherPass123!\",
    \"firstName\": \"Another\",
    \"lastName\": \"User\",
    \"role\": \"GUEST\"
  }")

[ "$DUPLICATE_RESPONSE" -eq 400 ]
print_result $? "Duplicate email rejected with 400"
echo ""

# Test 9: Access Protected Route Without Token
echo -e "${YELLOW}Test 9: Access Protected Route Without Token${NC}"
NO_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -X GET $BASE_URL/api/users/me)

[ "$NO_TOKEN_RESPONSE" -eq 401 ]
print_result $? "Protected route returns 401 without token"
echo ""

# Test 10: Logout
echo -e "${YELLOW}Test 10: Logout${NC}"
LOGOUT_RESPONSE=$(curl -s -X POST $BASE_URL/api/auth/logout \
  -H "$CONTENT_TYPE" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$LOGOUT_RESPONSE" | grep -q "success.*true"
print_result $? "Logout successful"
echo ""

# Print Summary
echo "================================"
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "================================"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ❌${NC}"
    exit 1
fi
