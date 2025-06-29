#!/bin/bash

# Project Management API Test Script
# This script tests all API endpoints with sample data

BASE_URL="http://localhost:3001/api"

# API Key for authentication (set this to your actual API key)
API_KEY="${API_KEY:-}"

echo "🚀 Testing Project Management API at $BASE_URL"
echo "=========================================="

# Check if API key is provided
if [ -z "$API_KEY" ]; then
    echo -e "${YELLOW}⚠ Warning: No API key provided${NC}"
    echo "Set the API_KEY environment variable or provide it as an argument:"
    echo "  export API_KEY='sb_your_api_key_here'"
    echo "  ./test-api.sh"
    echo ""
    echo "Or pass it as an argument:"
    echo "  ./test-api.sh sb_your_api_key_here"
    echo ""
    echo "🔑 To get an API key:"
    echo "  1. Sign in to the web application"
    echo "  2. Go to Profile → API Keys tab"
    echo "  3. Create a new API key"
    echo "  4. Copy the key and set it as API_KEY environment variable"
    echo ""
    exit 1
fi

# Use first argument as API key if provided
if [ -n "$1" ]; then
    API_KEY="$1"
fi

echo "Using API Key: ${API_KEY:0:8}...${API_KEY: -4}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print test results
print_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS${NC}: $2"
    else
        echo -e "${RED}✗ FAIL${NC}: $2"
    fi
}

# Function to make HTTP request and check status
test_endpoint() {
    local method=$1
    local url=$2
    local data=$3
    local expected_status=$4
    local description=$5
    local skip_auth=$6
    
    # Prepare auth header unless skipping auth
    local auth_header=""
    if [ "$skip_auth" != "true" ]; then
        auth_header="-H \"Authorization: Bearer $API_KEY\""
    fi
    
    if [ -n "$data" ]; then
        if [ "$skip_auth" = "true" ]; then
            response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$url" \
                -H "Content-Type: application/json" \
                -d "$data")
        else
            response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$url" \
                -H "Content-Type: application/json" \
                -H "Authorization: Bearer $API_KEY" \
                -d "$data")
        fi
    else
        if [ "$skip_auth" = "true" ]; then
            response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$url")
        else
            response=$(curl -s -w "%{http_code}" -X $method "$BASE_URL$url" \
                -H "Authorization: Bearer $API_KEY")
        fi
    fi
    
    http_code="${response: -3}"
    body="${response%???}"
    
    if [ "$http_code" = "$expected_status" ]; then
        print_result 0 "$description"
        echo "   Response: $body" | head -c 100
        [ ${#body} -gt 100 ] && echo "..."
        echo ""
    else
        print_result 1 "$description (Expected: $expected_status, Got: $http_code)"
        echo "   Response: $body"
        echo ""
    fi
    
    # Extract ID from response for subsequent tests
    if [ "$http_code" = "201" ] || [ "$http_code" = "200" ]; then
        echo "$body"
    fi
}

echo -e "${BLUE}1. Health Check${NC}"
echo "---------------"
test_endpoint "GET" "/health" "" "200" "Health check endpoint" "true"

echo -e "${BLUE}2. Project Operations${NC}"
echo "---------------------"

# Create a project
echo "Creating a test project..."
project_response=$(test_endpoint "POST" "/projects" '{
    "name": "API Test Project",
    "description": "A project created for API testing"
}' "201" "Create new project")

# Extract project ID (assuming jq is available, fallback to basic parsing)
if command -v jq &> /dev/null; then
    PROJECT_ID=$(echo "$project_response" | jq -r '.id')
else
    PROJECT_ID=$(echo "$project_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
fi

echo "Project ID: $PROJECT_ID"

# Test getting all projects
test_endpoint "GET" "/projects" "" "200" "Get all projects"

# Test getting specific project
if [ -n "$PROJECT_ID" ]; then
    test_endpoint "GET" "/projects/$PROJECT_ID" "" "200" "Get project by ID"
    
    # Update project
    test_endpoint "PUT" "/projects/$PROJECT_ID" '{
        "name": "Updated API Test Project",
        "status": "active"
    }' "200" "Update project"
fi

echo -e "${BLUE}3. Task Operations${NC}"
echo "------------------"

if [ -n "$PROJECT_ID" ]; then
    # Create a task
    echo "Creating a test task..."
    task_response=$(test_endpoint "POST" "/projects/$PROJECT_ID/tasks" '{
        "title": "API Test Task",
        "description": "A task created for API testing",
        "priority": "high",
        "dueDate": "2025-02-15T00:00:00Z"
    }' "201" "Create new task")
    
    # Extract task ID
    if command -v jq &> /dev/null; then
        TASK_ID=$(echo "$task_response" | jq -r '.id')
    else
        TASK_ID=$(echo "$task_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi
    
    echo "Task ID: $TASK_ID"
    
    if [ -n "$TASK_ID" ]; then
        # Get task by ID
        test_endpoint "GET" "/projects/$PROJECT_ID/tasks/$TASK_ID" "" "200" "Get task by ID"
        
        # Update task
        test_endpoint "PUT" "/projects/$PROJECT_ID/tasks/$TASK_ID" '{
            "status": "in_progress",
            "title": "Updated API Test Task"
        }' "200" "Update task"
    fi
else
    echo -e "${YELLOW}⚠ Skipping task tests - no project ID available${NC}"
fi

echo -e "${BLUE}4. Subtask Operations${NC}"
echo "---------------------"

if [ -n "$PROJECT_ID" ] && [ -n "$TASK_ID" ]; then
    # Create a subtask
    echo "Creating a test subtask..."
    subtask_response=$(test_endpoint "POST" "/projects/$PROJECT_ID/tasks/$TASK_ID/subtasks" '{
        "title": "API Test Subtask",
        "description": "A subtask created for API testing",
        "priority": "medium"
    }' "201" "Create new subtask")
    
    # Extract subtask ID
    if command -v jq &> /dev/null; then
        SUBTASK_ID=$(echo "$subtask_response" | jq -r '.id')
    else
        SUBTASK_ID=$(echo "$subtask_response" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)
    fi
    
    echo "Subtask ID: $SUBTASK_ID"
    
    if [ -n "$SUBTASK_ID" ]; then
        # Update subtask
        test_endpoint "PUT" "/projects/tasks/$TASK_ID/subtasks/$SUBTASK_ID" '{
            "status": "completed",
            "title": "Updated API Test Subtask"
        }' "200" "Update subtask"
        
        # Delete subtask
        test_endpoint "DELETE" "/projects/tasks/$TASK_ID/subtasks/$SUBTASK_ID" "" "204" "Delete subtask"
    fi
else
    echo -e "${YELLOW}⚠ Skipping subtask tests - no task ID available${NC}"
fi

echo -e "${BLUE}5. AI Chat Interface${NC}"
echo "--------------------"

# Test AI chat
test_endpoint "POST" "/chat/stream" '{
    "messages": [
        {
            "role": "user",
            "content": "List all my projects"
        }
    ]
}' "200" "AI Chat - List projects"

echo -e "${BLUE}6. Authentication Test${NC}"
echo "---------------------"

# Test unauthenticated request (should fail)
test_endpoint "GET" "/projects" "" "401" "Unauthenticated request (should fail)" "true"

# Test with invalid API key (should fail)
OLD_API_KEY="$API_KEY"
API_KEY="sb_invalid_key_for_testing"
test_endpoint "GET" "/projects" "" "401" "Invalid API key (should fail)"
API_KEY="$OLD_API_KEY"

# Test with valid API key (should succeed)
test_endpoint "GET" "/projects" "" "200" "Valid API key authentication"

echo -e "${BLUE}7. Cleanup${NC}"
echo "----------"

# Clean up created resources
if [ -n "$TASK_ID" ]; then
    test_endpoint "DELETE" "/projects/$PROJECT_ID/tasks/$TASK_ID" "" "204" "Delete test task"
fi

if [ -n "$PROJECT_ID" ]; then
    test_endpoint "DELETE" "/projects/$PROJECT_ID" "" "204" "Delete test project"
fi

echo ""
echo -e "${GREEN}🎉 API Testing Complete!${NC}"
echo ""
echo -e "${BLUE}📚 Documentation Available:${NC}"
echo "   • Interactive API Docs: http://localhost:3001/api-docs"
echo "   • Markdown Documentation: ./API_DOCUMENTATION.md"
echo ""
echo -e "${BLUE}🔗 Quick Links:${NC}"
echo "   • Health Check: curl $BASE_URL/health"
echo "   • List Projects: curl -H \"Authorization: Bearer YOUR_API_KEY\" $BASE_URL/projects"
echo "   • Swagger UI: http://localhost:3001/api-docs"
echo ""
echo -e "${BLUE}🔑 API Key Usage:${NC}"
echo "   • Get API key from web app: Profile → API Keys → Create New"
echo "   • Use in requests: curl -H \"Authorization: Bearer sb_your_key\" $BASE_URL/projects"
echo "   • Run this script: export API_KEY='sb_your_key' && ./test-api.sh"