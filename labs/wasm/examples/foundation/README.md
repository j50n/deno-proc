# Foundation Demo

A complete example showing Odin + WASM + Deno integration:

- **TypeScript wrapper** for WASM instantiation  
- **OdinRuntime** providing all `odin_env` imports
- **Memory management** with `--import-memory`
- **String handling** (UTF-8 encoding/decoding)
- **Struct returns** (pointer and by-value patterns)

## Files

- `odin/demo.odin` - Exported Odin functions
- `odin-runtime.ts` - Runtime environment for `odin_env`
- `demo.ts` - TypeScript wrapper class
- `demo.test.ts` - Test suite
- `RUNME.ts` - Executable demo
- `build.sh` - Build pipeline

## Usage

```bash
./build.sh     # Build and test everything
deno run --allow-read RUNME.ts  # Run demo
```

## Architecture

```
Demo.create() → WebAssembly.instantiate()
                    ↓
              ┌─────┴─────┐
              │           │
         env: { memory }  odin_env: runtime.env
              │           │
              └─────┬─────┘
                    ↓
              Odin WASM Module
```

## Key Patterns

**Imported memory** - JavaScript creates and owns memory:
```typescript
const memory = new WebAssembly.Memory({ initial: 17, maximum: 256 });
const runtime = new OdinRuntime(memory);
```

**String passing** - Allocate → write → call → free:
```typescript
const ptr = exports.alloc_string(bytes.length);
new Uint8Array(memory.buffer).set(bytes, ptr);
exports.my_function(ptr, bytes.length);
exports.free_string(ptr, bytes.length);
```
