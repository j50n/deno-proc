# Process-Odin

High-performance CSV processing child process implementation in Odin, compatible with the process-ts StringRow binary format.

## Architecture

```
process-odin/
├── odin/                    # Odin source code
│   ├── string_row/          # StringRow serialization library
│   │   ├── string_row.odin  # Core StringRow implementation
│   │   └── tests.odin       # Unit tests
│   ├── csv_parser/          # CSV parsing integration
│   │   ├── parser.odin      # CSV to StringRow conversion
│   │   └── tests.odin       # Unit tests
│   ├── child_process/       # Main child process program
│   │   └── main.odin        # Entry point
│   └── shared/              # Shared utilities
│       └── io.odin          # I/O helpers
├── tests/                   # Integration tests
├── benchmarks/              # Performance benchmarks
├── Makefile                 # Build system
└── README.md               # This file
```

## StringRow Binary Format

Compatible with TypeScript implementation:
- `[columnCount:i32][positions:i32...][text_data]`
- Little-endian byte order
- UTF-8 text encoding
- Positions array has `columnCount + 1` entries (start positions + final end)

## Build & Test

```bash
make build      # Build all components
make test       # Run all tests
make benchmark  # Run performance tests
make clean      # Clean build artifacts
```

## Usage

```bash
# As child process (reads CSV from stdin, outputs StringRow format)
./child_process < input.csv > output.stringrow

# Integration with process-ts parent
echo "a,b,c\n1,2,3" | ./child_process | parent_process
```
