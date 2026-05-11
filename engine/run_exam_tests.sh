#!/bin/bash
# Run Exam Generation End-to-End Tests
# Usage: ./run_exam_tests.sh [pytest args]

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}========================================${NC}"
echo -e "${YELLOW}Exam Generation Pipeline E2E Tests${NC}"
echo -e "${YELLOW}========================================${NC}"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo -e "${RED}Error: Virtual environment not found at ./venv${NC}"
    echo "Please create and activate the virtual environment first."
    exit 1
fi

# Source virtual environment
source venv/bin/activate

# Set required environment variables
export OLLAMA_GENERATION_MODEL=${OLLAMA_GENERATION_MODEL:-qwen2.5:7b-instruct}
export DATABASE_URL=${DATABASE_URL:-postgresql://localhost/cognify}

echo -e "${YELLOW}Using model:${NC} $OLLAMA_GENERATION_MODEL"
echo -e "${YELLOW}Database URL:${NC} $DATABASE_URL"
echo ""

# Run tests with pytest
# Default to verbose output with short tracebacks
ARGS="${1:--v --tb=short}"

echo -e "${YELLOW}Running tests...${NC}"
echo ""

if python3 -m pytest tests/test_exam_generation_e2e.py $ARGS; then
    echo ""
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo -e "${GREEN}========================================${NC}"
    exit 0
else
    echo ""
    echo -e "${RED}✗ Some tests failed${NC}"
    echo -e "${RED}========================================${NC}"
    exit 1
fi
