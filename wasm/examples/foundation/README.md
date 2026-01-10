# Simpler Math Demo

A clean example showing:
- **TypeScript class** wrapping WASM instantiation  
- **Odin functions** exported to JavaScript
- **Runtime integration** with comprehensive Odin runtime support
- **Memory management** demonstration
- **Multiple instances** with isolated memory

## Files
- `odin/math_demo.odin` - Exported functions (math + memory)
- `math-demo.ts` - TypeScript class with OdinRuntime
- `math-demo.test.ts` - Comprehensive test suite
- `RUNME.ts` - Executable demo script
- `build.sh` - Complete build pipeline

## Key Features
- **Async factory pattern** for WASM instantiation
- **OdinRuntime class** providing all necessary imports
- **Math functions** (circle area, fibonacci)
- **Memory allocation** demonstration
- **Comprehensive testing** with detailed verification
- **Instance lifecycle management** with proper disposal

## Usage
```bash
./build.sh     # Build and test everything
./RUNME.ts     # Run demo directly
```

## Architecture
```
TypeScript MathDemo → WASM Instance → Odin Functions
                   ↑                      ↓
              OdinRuntime ←── Imports ────┘
```
