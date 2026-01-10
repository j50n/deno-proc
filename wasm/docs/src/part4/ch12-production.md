# Production Deployment

Your WASM module works in development. Now let's make it production-ready.

## Distribution Strategies

### Bundled with Application

The simplest approach—include the `.wasm` file with your application:

```
my-app/
├── src/
│   ├── main.ts
│   └── demo.ts
├── wasm/
│   └── demo.wasm
└── deno.json
```

Load relative to your module:

```typescript
const wasmPath = new URL("../wasm/demo.wasm", import.meta.url).pathname;
```

### CDN Distribution

For web applications, serve WASM from a CDN:

```typescript
const wasmUrl = "https://cdn.example.com/wasm/demo.wasm";
const response = await fetch(wasmUrl);
const wasmBytes = await response.arrayBuffer();
const module = await WebAssembly.compile(wasmBytes);
```

Set appropriate headers:
```
Content-Type: application/wasm
Cache-Control: public, max-age=31536000, immutable
```

### NPM/JSR Package

Publish as a package with the WASM file included:

```json
// deno.json
{
  "name": "@yourname/demo",
  "version": "1.0.0",
  "exports": "./mod.ts"
}
```

```typescript
// mod.ts
export { Demo } from "./demo.ts";
```

Users install and use:
```typescript
import { Demo } from "@yourname/demo";
const demo = await Demo.create();
```

## Loading Optimization

### Streaming Compilation

For large modules, compile while downloading:

```typescript
const response = await fetch(wasmUrl);
const module = await WebAssembly.compileStreaming(response);
```

This starts compilation before the download completes—faster than waiting for the full file.

### Caching Compiled Modules

Compilation is expensive. Cache the result:

```typescript
class ModuleCache {
  private static cache = new Map<string, WebAssembly.Module>();
  
  static async get(url: string): Promise<WebAssembly.Module> {
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }
    
    const response = await fetch(url);
    const module = await WebAssembly.compileStreaming(response);
    this.cache.set(url, module);
    return module;
  }
}
```

For persistence across page loads (browser), use IndexedDB:

```typescript
async function getCachedModule(url: string): Promise<WebAssembly.Module> {
  const db = await openDB("wasm-cache", 1, {
    upgrade(db) {
      db.createObjectStore("modules");
    },
  });
  
  let module = await db.get("modules", url);
  
  if (!module) {
    const response = await fetch(url);
    module = await WebAssembly.compileStreaming(response);
    await db.put("modules", module, url);
  }
  
  return module;
}
```

### Preloading

Load WASM before it's needed:

```typescript
// Start loading immediately
const modulePromise = WebAssembly.compileStreaming(fetch(wasmUrl));

// Later, when needed
async function createDemo(): Promise<Demo> {
  const module = await modulePromise; // Already loaded
  return Demo.fromModule(module);
}
```

## Security Considerations

### Content Security Policy

If using CSP, allow WASM:

```
Content-Security-Policy: script-src 'self' 'wasm-unsafe-eval'
```

The `wasm-unsafe-eval` directive permits WASM compilation.

### Input Validation

Never trust input to WASM functions:

```typescript
calculateCircle(radius: number): number {
  // Validate before passing to WASM
  if (!Number.isFinite(radius)) {
    throw new Error("Invalid radius: must be finite");
  }
  if (radius < 0) {
    throw new Error("Invalid radius: must be non-negative");
  }
  if (radius > 1e10) {
    throw new Error("Invalid radius: too large");
  }
  
  return this.exports.calculate_circle(radius);
}
```

### Memory Bounds

Ensure pointers stay within bounds:

```typescript
function safeRead(memory: WebAssembly.Memory, ptr: number, len: number): Uint8Array {
  const maxAddr = memory.buffer.byteLength;
  
  if (ptr < 0 || len < 0 || ptr + len > maxAddr) {
    throw new Error(`Out of bounds: ptr=${ptr}, len=${len}, max=${maxAddr}`);
  }
  
  return new Uint8Array(memory.buffer, ptr, len);
}
```

### Sandboxing

WASM is sandboxed by design—it can only access what you provide. Keep imports minimal:

```typescript
// Only provide what's necessary
const imports = {
  env: {
    // Math functions - safe
    sin: Math.sin,
    cos: Math.cos,
    
    // Don't expose file system, network, etc.
  },
};
```

## Error Monitoring

### Structured Error Handling

```typescript
class WasmError extends Error {
  constructor(
    message: string,
    public readonly wasmFunction: string,
    public readonly inputs: unknown[],
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "WasmError";
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      wasmFunction: this.wasmFunction,
      inputs: this.inputs,
      stack: this.stack,
    };
  }
}

function wrapWasmCall<T>(
  name: string,
  fn: (...args: unknown[]) => T,
  ...args: unknown[]
): T {
  try {
    return fn(...args);
  } catch (e) {
    throw new WasmError(
      `WASM call failed: ${name}`,
      name,
      args,
      e instanceof Error ? e : undefined
    );
  }
}
```

### Logging

```typescript
class WasmLogger {
  private logs: Array<{
    timestamp: number;
    level: string;
    message: string;
    data?: unknown;
  }> = [];
  
  log(level: string, message: string, data?: unknown): void {
    this.logs.push({
      timestamp: Date.now(),
      level,
      message,
      data,
    });
    
    // Also send to monitoring service
    if (level === "error") {
      this.reportError(message, data);
    }
  }
  
  private reportError(message: string, data?: unknown): void {
    // Send to your error tracking service
    // e.g., Sentry, DataDog, etc.
  }
  
  getLogs(): typeof this.logs {
    return [...this.logs];
  }
}
```

## Health Checks

Verify WASM is working:

```typescript
class HealthCheck {
  static async verify(demo: Demo): Promise<boolean> {
    try {
      // Test basic functionality
      const result = demo.calculateCircle(1);
      if (Math.abs(result - Math.PI) > 0.0001) {
        throw new Error("Calculation mismatch");
      }
      
      // Test memory operations
      const testData = new Uint8Array([1, 2, 3, 4]);
      // ... verify memory read/write
      
      return true;
    } catch (e) {
      console.error("Health check failed:", e);
      return false;
    }
  }
}

// On startup
const demo = await Demo.create();
if (!await HealthCheck.verify(demo)) {
  throw new Error("WASM module failed health check");
}
```

## Graceful Degradation

Have a fallback when WASM fails:

```typescript
class MathService {
  private wasmDemo: Demo | null = null;
  
  async initialize(): Promise<void> {
    try {
      this.wasmDemo = await Demo.create();
    } catch (e) {
      console.warn("WASM unavailable, using JS fallback:", e);
    }
  }
  
  calculateCircle(radius: number): number {
    if (this.wasmDemo) {
      return this.wasmDemo.calculateCircle(radius);
    }
    // JavaScript fallback
    return Math.PI * radius * radius;
  }
}
```

## Deployment Checklist

Before deploying:

- [ ] All tests pass
- [ ] WASM file is optimized (`-o:speed` or `-o:size`)
- [ ] Bundle size is acceptable
- [ ] Error handling covers all edge cases
- [ ] Input validation is in place
- [ ] Health checks are implemented
- [ ] Monitoring is configured
- [ ] Fallbacks exist for critical functionality
- [ ] CSP headers allow WASM (if applicable)
- [ ] Caching headers are set correctly
- [ ] Documentation is updated

Production WASM is about reliability as much as performance. Build for both.
