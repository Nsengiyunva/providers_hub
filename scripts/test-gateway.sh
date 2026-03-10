#!/bin/bash

# API Gateway Testing Script
set -e

GATEWAY_URL="http://localhost:3000"
CONTENT_TYPE="Content-Type: application/json"

echo "🧪 API Gateway Testing Script"
echo "=============================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

TESTS_PASSED=0
TESTS_FAILED=0

print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
        ((TESTS_FAILED++))
    fi
}

print_header() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

# ============ GATEWAY HEALTH TESTS ============
print_header "Gateway Health Tests"

echo "Test 1: Gateway Health Check"
HEALTH_RESPONSE=$(curl -s $GATEWAY_URL/health)
echo "$HEALTH_RESPONSE" | grep -q "healthy"
print_result $? "Gateway health endpoint returns healthy status"

echo "Test 2: Gateway Version"
VERSION_RESPONSE=$(curl -s $GATEWAY_URL/version)
echo "$VERSION_RESPONSE" | grep -q "version"
print_result $? "Gateway version endpoint returns version info"

echo "Test 3: Services Status"
STATUS_RESPONSE=$(curl -s $GATEWAY_URL/services/status)
echo "$STATUS_RESPONSE" | grep -q "services"
print_result $? "Gateway services status endpoint works"

# ============ ROUTING TESTS ============
print_header "Routing Tests"

echo "Test 4: Route to User Service (Register)"
TEST_EMAIL="gateway_test_$(date +%s)@test.com"
REGISTER_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST $GATEWAY_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"GatewayTest123!\",
    \"firstName\": \"Gateway\",
    \"lastName\": \"Test\",
    \"role\": \"GUEST\"
  }")

HTTP_CODE=$(echo "$REGISTER_RESPONSE" | tail -n1)
[ "$HTTP_CODE" -eq 201 ]
print_result $? "Request routed to User Service successfully (201)"

echo "Test 5: Route to User Service (Login)"
LOGIN_RESPONSE=$(curl -s -X POST $GATEWAY_URL/api/auth/login \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"GatewayTest123!\"
  }")

echo "$LOGIN_RESPONSE" | grep -q "accessToken"
print_result $? "Login request routed and returns tokens"

# Extract token for authenticated tests
ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)

# ============ AUTHENTICATION TESTS ============
print_header "Authentication & Authorization Tests"

echo "Test 6: Protected Route Without Token"
NO_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET $GATEWAY_URL/api/auth/me)

[ "$NO_TOKEN_RESPONSE" -eq 401 ]
print_result $? "Protected route returns 401 without token"

echo "Test 7: Protected Route With Valid Token"
WITH_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET $GATEWAY_URL/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

[ "$WITH_TOKEN_RESPONSE" -eq 200 ]
print_result $? "Protected route returns 200 with valid token"

echo "Test 8: Protected Route With Invalid Token"
INVALID_TOKEN_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X GET $GATEWAY_URL/api/auth/me \
  -H "Authorization: Bearer invalid_token_here")

[ "$INVALID_TOKEN_RESPONSE" -eq 401 ]
print_result $? "Protected route returns 401 with invalid token"

# ============ RATE LIMITING TESTS ============
print_header "Rate Limiting Tests"

echo "Test 9: Rate Limiting (Multiple Requests)"
RATE_LIMIT_PASSED=true
RATE_LIMIT_TRIGGERED=false

# Make 6 rapid requests to trigger rate limit (limit is 5 for login)
for i in {1..6}; do
    RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X POST $GATEWAY_URL/api/auth/login \
      -H "$CONTENT_TYPE" \
      -d "{\"email\":\"test@test.com\",\"password\":\"wrong\"}")
    
    if [ $i -le 5 ] && [ "$RESPONSE" -ne 401 ]; then
        RATE_LIMIT_PASSED=false
    fi
    
    if [ $i -eq 6 ] && [ "$RESPONSE" -eq 429 ]; then
        RATE_LIMIT_TRIGGERED=true
    fi
done

if [ "$RATE_LIMIT_TRIGGERED" = true ]; then
    print_result 0 "Rate limiting triggers after threshold"
else
    print_result 1 "Rate limiting did not trigger as expected"
fi

echo "Test 10: Rate Limit Headers Present"
HEADER_RESPONSE=$(curl -s -I $GATEWAY_URL/health)
echo "$HEADER_RESPONSE" | grep -q "X-RateLimit-Limit"
print_result $? "Rate limit headers present in response"

# ============ CORRELATION ID TESTS ============
print_header "Request Tracking Tests"

echo "Test 11: Correlation ID in Response"
CORRELATION_RESPONSE=$(curl -s -I $GATEWAY_URL/health)
echo "$CORRELATION_RESPONSE" | grep -q "X-Correlation-ID"
print_result $? "Correlation ID header present in response"

echo "Test 12: Custom Correlation ID Preserved"
CUSTOM_CORRELATION_ID="test-correlation-$(date +%s)"
CUSTOM_CORR_RESPONSE=$(curl -s -I $GATEWAY_URL/health \
  -H "X-Correlation-ID: $CUSTOM_CORRELATION_ID")

echo "$CUSTOM_CORR_RESPONSE" | grep -q "$CUSTOM_CORRELATION_ID"
print_result $? "Custom correlation ID is preserved"

# ============ ERROR HANDLING TESTS ============
print_header "Error Handling Tests"

echo "Test 13: 404 for Unknown Endpoint"
NOT_FOUND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  $GATEWAY_URL/api/unknown/endpoint)

[ "$NOT_FOUND_RESPONSE" -eq 404 ]
print_result $? "Returns 404 for unknown endpoints"

echo "Test 14: Error Response Format"
ERROR_RESPONSE=$(curl -s $GATEWAY_URL/api/unknown/endpoint)
echo "$ERROR_RESPONSE" | grep -q '"success":false'
print_result $? "Error responses have correct format"

# ============ SECURITY TESTS ============
print_header "Security Tests"

echo "Test 15: CORS Headers Present"
CORS_RESPONSE=$(curl -s -I -X OPTIONS $GATEWAY_URL/health)
echo "$CORS_RESPONSE" | grep -q "Access-Control"
print_result $? "CORS headers present in response"

echo "Test 16: Security Headers (Helmet)"
SECURITY_RESPONSE=$(curl -s -I $GATEWAY_URL/health)
echo "$SECURITY_RESPONSE" | grep -q "X-Content-Type-Options"
print_result $? "Security headers (Helmet) present"

# ============ PROXY FUNCTIONALITY TESTS ============
print_header "Proxy Functionality Tests"

echo "Test 17: Path Rewriting"
# Register endpoint should work at /api/auth/register
PATH_REWRITE_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST $GATEWAY_URL/api/auth/register \
  -H "$CONTENT_TYPE" \
  -d "{
    \"email\": \"path_test_$(date +%s)@test.com\",
    \"password\": \"PathTest123!\",
    \"firstName\": \"Path\",
    \"lastName\": \"Test\",
    \"role\": \"GUEST\"
  }")

[ "$PATH_REWRITE_RESPONSE" -eq 201 ]
print_result $? "Path rewriting works correctly"

echo "Test 18: Header Injection (User Context)"
# Make authenticated request and check if service receives user headers
USER_CONTEXT_RESPONSE=$(curl -s $GATEWAY_URL/api/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "$USER_CONTEXT_RESPONSE" | grep -q "id"
print_result $? "User context headers injected correctly"

# ============ PERFORMANCE TESTS ============
print_header "Performance Tests"

echo "Test 19: Response Time (should be < 500ms)"
START_TIME=$(date +%s%N)
curl -s $GATEWAY_URL/health > /dev/null
END_TIME=$(date +%s%N)
DURATION=$(( ($END_TIME - $START_TIME) / 1000000 ))

[ $DURATION -lt 500 ]
print_result $? "Response time acceptable (${DURATION}ms)"

# ============ CLEANUP ============
print_header "Cleanup"

# Wait for rate limit to reset
echo "Waiting 5 seconds for rate limits to reset..."
sleep 5

# ============ SUMMARY ============
echo ""
echo "=============================="
echo -e "${GREEN}Tests Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Tests Failed: $TESTS_FAILED${NC}"
echo "=============================="

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! 🎉${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed! ❌${NC}"
    exit 1
fi
