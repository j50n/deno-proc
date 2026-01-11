#!/bin/bash

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Transform Functions Benchmark Suite${NC}"
echo "===================================="

# Check if we're in the right directory and navigate to project root
if [[ -f "deno.json" ]]; then
    # Already in project root
    PROJECT_ROOT="."
elif [[ -f "../deno.json" ]]; then
    # In benchmarks folder, go up one level
    PROJECT_ROOT=".."
    cd ..
else
    echo -e "${RED}Error: Must be run from project root or benchmarks directory${NC}"
    exit 1
fi

# Lint and check benchmark scripts
echo -e "\n${YELLOW}1. Linting benchmark scripts...${NC}"
deno lint benchmarks/
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Lint passed${NC}"
else
    echo -e "${RED}✗ Lint failed${NC}"
    exit 1
fi

echo -e "\n${YELLOW}2. Type checking benchmark scripts...${NC}"
deno check benchmarks/transforms/*.ts benchmarks/data/generate_datasets.ts
if [[ $? -eq 0 ]]; then
    echo -e "${GREEN}✓ Type check passed${NC}"
else
    echo -e "${RED}✗ Type check failed${NC}"
    exit 1
fi

# Generate test data if needed
echo -e "\n${YELLOW}3. Checking test data...${NC}"

# Always generate fresh test data for consistent benchmarks
echo -e "${BLUE}Generating test datasets (this may take a few minutes)...${NC}"
./benchmarks/data/generate_datasets.ts
echo -e "${GREEN}✓ Test data generated${NC}"

# Run benchmarks
echo -e "\n${YELLOW}4. Running benchmarks...${NC}"

echo -e "\n${BLUE}Streaming Performance (Primary):${NC}"
timeout 300s deno run --allow-read benchmarks/transforms/streaming_performance.ts || {
    echo -e "${RED}Streaming benchmark timed out or failed${NC}"
}

echo -e "\n${BLUE}LazyRow Performance:${NC}"
timeout 60s deno run --allow-read benchmarks/transforms/lazy_row_performance.ts || {
    echo -e "${RED}LazyRow benchmark timed out or failed${NC}"
}

echo -e "\n${BLUE}CSV Performance:${NC}"
timeout 120s deno run --allow-read benchmarks/transforms/csv_performance.ts || {
    echo -e "${RED}CSV benchmark timed out or failed${NC}"
}

echo -e "\n${BLUE}Comparative Analysis:${NC}"
timeout 180s deno run --allow-read benchmarks/transforms/comparative_analysis.ts || {
    echo -e "${RED}Comparative analysis timed out or failed${NC}"
}

echo -e "\n${GREEN}Benchmark suite completed!${NC}"

# Clean up test data files
echo -e "\n${YELLOW}5. Cleaning up test data...${NC}"
rm -f benchmarks/data/*.{csv,tsv,json} 2>/dev/null || true
echo -e "${GREEN}✓ Test data cleaned up${NC}"

echo -e "\n${BLUE}To run individual benchmarks:${NC}"
echo "  deno run --allow-read benchmarks/transforms/streaming_performance.ts"
echo "  deno run --allow-read benchmarks/transforms/csv_performance.ts"
echo "  deno run --allow-read benchmarks/transforms/lazy_row_performance.ts"
echo "  deno run --allow-read benchmarks/transforms/comparative_analysis.ts"
