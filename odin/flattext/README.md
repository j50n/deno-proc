# FlatText Converter

CSV/TSV converter using Odin WASM backend.

## Structure

```
odin/flattext/
├── DESIGN.md           # Original design document
├── main.odin           # Original complex CSV parser (with memory issues)
├── simple.odin         # Working fixed-buffer CSV parser  
├── flattext-api.ts     # TypeScript API wrapper
├── build-simple.sh     # Build script for WASM module
├── README.md           # Local documentation
├── examples/           # Example usage files
├── tests/              # Test files
└── docs/               # Documentation
```

## Quick Start

```bash
# Build WASM module
cd odin/flattext
./build-simple.sh

# Run examples
cd examples
./example.ts

# Run tests  
cd ../tests
./flattext_test.ts
```

## Usage

```typescript
import { FlatText } from "./odin/flattext/flattext-api.ts";

const converter = await FlatText.create();
const tsv = converter.csvToTsv("name,age\nJohn,30");
```

See `docs/` for full documentation.
