# FlatText CSV/TSV Converter

High-performance CSV/TSV converter using Odin WASM for parsing and TypeScript for I/O orchestration.

## Current Status (January 2026)

**✅ Working Implementation:**
- Streaming-only CSV/TSV conversion using Deno's standard CSV parser
- Memory-efficient processing with `enumerate/writeTo` pattern
- CLI tool with comprehensive configuration options
- 30+ passing tests for basic functionality

**❌ Known Limitations:**
- Uses standard CSV parser instead of custom WASM parser
- Missing advanced features: `replaceTabs`, `replaceNewlines`
- Defeats original purpose of high-performance WASM parsing

**🚀 Next Direction: WASI Integration**
- Direct stdin/stdout processing in WASM
- Eliminates JavaScript ↔ WASM memory copying
- Simpler architecture with blocking execution model
- True high-performance streaming with WASM parser

## Architecture

Current streaming implementation uses:
- **Input**: `enumerate(Deno.stdin.readable)` for chunk processing
- **Processing**: Deno's `@std/csv` parser (temporary solution)
- **Output**: `writeTo(Deno.stdout.writable)` for streaming output
- **CLI**: Cliffy-based command interface with full configuration

## Usage

```bash
# CSV to TSV conversion
cat input.csv | deno run --allow-read --allow-write flattext.ts csv2tsv > output.tsv

# TSV to CSV conversion  
cat input.tsv | deno run --allow-read --allow-write flattext.ts tsv2csv > output.csv

# With configuration options
cat data.csv | ./flattext.ts csv2tsv --delimiter ";" --comment "#" > output.tsv
```

## Development Notes

- **Design documentation**: See `odin/flattext/DESIGN.md` for comprehensive architecture
- **Test suite**: 50+ tests in `tests/flattext/` (currently adapted for streaming API)
- **Experiments**: Large experimental codebase in `experiments/` (excluded from production)
- **WASI research**: Documented approach for next implementation iteration

## Repository Management

This project contains experimental code and large data files. For production deployment:
1. Use orphan branch strategy to create clean history
2. Exclude `experiments/` folder from production commits
3. Maintain only essential code and documentation

## Next Steps

The WASI approach represents a fundamental shift that could eliminate most streaming complexity:
- WASM handles entire stdin→stdout pipeline
- No memory copying between JavaScript and WASM
- Command-line arguments pass configuration directly
- Blocking execution model simplifies architecture

See `odin/flattext/DESIGN.md` for detailed WASI implementation strategy.
