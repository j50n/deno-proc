# Odin compiler and flags
ODIN := odin
ODIN_FLAGS := -o:speed

# Directories
ODIN_DIR := odin
BUILD_DIR := build
TEST_DIR := tests

# Targets
CHILD_PROCESS := $(BUILD_DIR)/child_process

.PHONY: all build test benchmark clean setup

all: build

setup:
	@mkdir -p $(BUILD_DIR)
	@mkdir -p $(TEST_DIR)

build: setup $(CHILD_PROCESS)

$(CHILD_PROCESS): $(ODIN_DIR)/child_process/main.odin $(ODIN_DIR)/string_row/string_row.odin $(ODIN_DIR)/csv_parser/parser.odin
	$(ODIN) build $(ODIN_DIR)/child_process -out:$(CHILD_PROCESS) $(ODIN_FLAGS)

test: build
	@echo "Running StringRow tests..."
	$(ODIN) test $(ODIN_DIR)/string_row $(ODIN_FLAGS)
	@echo "Running CSV parser tests..."
	$(ODIN) test $(ODIN_DIR)/csv_parser $(ODIN_FLAGS)
	@echo "Running integration tests..."
	@./run_integration_tests.sh

benchmark: build
	@echo "Running benchmarks..."
	@./run_benchmarks.sh

clean:
	rm -rf $(BUILD_DIR)
	rm -f $(ODIN_DIR)/**/*.bin

install: build
	cp $(CHILD_PROCESS) /usr/local/bin/process-odin-child

.PHONY: help
help:
	@echo "Available targets:"
	@echo "  build      - Build the child process executable"
	@echo "  test       - Run all tests"
	@echo "  benchmark  - Run performance benchmarks"
	@echo "  clean      - Clean build artifacts"
	@echo "  install    - Install to /usr/local/bin"
