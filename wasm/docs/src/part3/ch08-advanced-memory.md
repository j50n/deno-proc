# Advanced Memory Management

You understand the basics—linear memory, pointers, reading and writing bytes. Now let's explore patterns for managing memory effectively in real applications.

## Allocation Strategies

### The Simple Bump Allocator

The simplest allocator just increments a pointer:

```odin
allocator_offset: int = 1024  // Start after reserved space

@(export)
bump_alloc :: proc "c" (size: int) -> rawptr {
    ptr := rawptr(uintptr(allocator_offset))
    allocator_offset += size
    return ptr
}
```

Fast and simple. The catch? Memory is never freed. Works great for:
- Short-lived instances
- Batch processing where you reset between batches
- Situations where total allocation is bounded

### Arena Allocation

Arenas group allocations that share a lifetime:

```typescript
class MemoryArena {
  private base: number;
  private offset: number;
  private capacity: number;
  
  constructor(
    private memory: WebAssembly.Memory,
    base: number,
    capacity: number
  ) {
    this.base = base;
    this.offset = 0;
    this.capacity = capacity;
  }
  
  alloc(size: number, align: number = 8): number {
    // Align the offset
    const aligned = (this.base + this.offset + align - 1) & ~(align - 1);
    const newOffset = aligned - this.base + size;
    
    if (newOffset > this.capacity) {
      throw new Error("Arena exhausted");
    }
    
    this.offset = newOffset;
    return aligned;
  }
  
  reset(): void {
    this.offset = 0;
  }
  
  used(): number {
    return this.offset;
  }
}
```

Use arenas when you have clear phases:

```typescript
const arena = new MemoryArena(memory, 65536, 1024 * 1024);

// Process batch 1
const ptr1 = arena.alloc(1000);
const ptr2 = arena.alloc(2000);
processBatch(ptr1, ptr2);
arena.reset();

// Process batch 2 - reuses same memory
const ptr3 = arena.alloc(1500);
processBatch(ptr3);
arena.reset();
```

### Pool Allocation

For fixed-size objects, pools are efficient:

```typescript
class ObjectPool<T> {
  private freeList: number[] = [];
  private objectSize: number;
  
  constructor(
    private memory: WebAssembly.Memory,
    private base: number,
    objectSize: number,
    count: number
  ) {
    this.objectSize = objectSize;
    
    // Initialize free list
    for (let i = count - 1; i >= 0; i--) {
      this.freeList.push(base + i * objectSize);
    }
  }
  
  alloc(): number {
    const ptr = this.freeList.pop();
    if (ptr === undefined) {
      throw new Error("Pool exhausted");
    }
    return ptr;
  }
  
  free(ptr: number): void {
    this.freeList.push(ptr);
  }
}
```

Pools give O(1) allocation and deallocation with zero fragmentation.

## Growing Memory

When you need more memory than initially allocated:

```typescript
function ensureCapacity(memory: WebAssembly.Memory, needed: number): void {
  const current = memory.buffer.byteLength;
  if (needed <= current) return;
  
  const pagesNeeded = Math.ceil((needed - current) / 65536);
  const result = memory.grow(pagesNeeded);
  
  if (result === -1) {
    throw new Error(`Failed to grow memory by ${pagesNeeded} pages`);
  }
}
```

Remember: after `memory.grow()`, all existing `ArrayBuffer` views are detached. Recreate them:

```typescript
class SafeMemoryView {
  private memory: WebAssembly.Memory;
  private _bytes: Uint8Array | null = null;
  
  constructor(memory: WebAssembly.Memory) {
    this.memory = memory;
  }
  
  get bytes(): Uint8Array {
    // Always create fresh view
    return new Uint8Array(this.memory.buffer);
  }
  
  // Or cache with invalidation
  invalidate(): void {
    this._bytes = null;
  }
  
  get cachedBytes(): Uint8Array {
    if (!this._bytes || this._bytes.buffer !== this.memory.buffer) {
      this._bytes = new Uint8Array(this.memory.buffer);
    }
    return this._bytes;
  }
}
```

## Alignment

Different data types have alignment requirements:

| Type | Alignment |
|------|-----------|
| `i8`, `u8` | 1 byte |
| `i16`, `u16` | 2 bytes |
| `i32`, `u32`, `f32` | 4 bytes |
| `i64`, `u64`, `f64` | 8 bytes |

Misaligned access works but may be slower. Some platforms trap on misalignment.

Align allocations:

```typescript
function alignUp(value: number, alignment: number): number {
  return (value + alignment - 1) & ~(alignment - 1);
}

function allocAligned(arena: MemoryArena, size: number, align: number): number {
  return arena.alloc(size, align);
}
```

## Memory Layout for Structures

When passing structures between JavaScript and WASM, layout matters.

Odin structure:
```odin
Point :: struct {
    x: f64,  // offset 0, size 8
    y: f64,  // offset 8, size 8
}
```

JavaScript reading:
```typescript
function readPoint(memory: WebAssembly.Memory, ptr: number): { x: number; y: number } {
  const view = new DataView(memory.buffer);
  return {
    x: view.getFloat64(ptr, true),      // true = little-endian
    y: view.getFloat64(ptr + 8, true),
  };
}
```

JavaScript writing:
```typescript
function writePoint(memory: WebAssembly.Memory, ptr: number, x: number, y: number): void {
  const view = new DataView(memory.buffer);
  view.setFloat64(ptr, x, true);
  view.setFloat64(ptr + 8, y, true);
}
```

Use `DataView` for structured data—it handles alignment and endianness correctly.

## Debugging Memory Issues

### Memory Dump

```typescript
function hexDump(memory: WebAssembly.Memory, start: number, length: number): void {
  const bytes = new Uint8Array(memory.buffer, start, length);
  const lines: string[] = [];
  
  for (let i = 0; i < length; i += 16) {
    const hex = Array.from(bytes.slice(i, i + 16))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    
    const ascii = Array.from(bytes.slice(i, i + 16))
      .map(b => b >= 32 && b < 127 ? String.fromCharCode(b) : '.')
      .join('');
    
    lines.push(`${(start + i).toString(16).padStart(8, '0')}  ${hex.padEnd(48)}  ${ascii}`);
  }
  
  console.log(lines.join('\n'));
}
```

### Memory Statistics

```typescript
class MemoryStats {
  constructor(private memory: WebAssembly.Memory) {}
  
  report(): void {
    const total = this.memory.buffer.byteLength;
    const pages = total / 65536;
    
    console.log(`Memory: ${total} bytes (${pages} pages)`);
    console.log(`  ${(total / 1024 / 1024).toFixed(2)} MB`);
  }
}
```

### Canary Values

Detect buffer overflows with canary values:

```typescript
const CANARY = 0xDEADBEEF;

function allocWithCanary(arena: MemoryArena, size: number): number {
  const ptr = arena.alloc(size + 8); // Extra space for canaries
  const view = new DataView(arena.memory.buffer);
  
  view.setUint32(ptr, CANARY, true);
  view.setUint32(ptr + size + 4, CANARY, true);
  
  return ptr + 4; // Return pointer past first canary
}

function checkCanary(memory: WebAssembly.Memory, ptr: number, size: number): boolean {
  const view = new DataView(memory.buffer);
  const before = view.getUint32(ptr - 4, true);
  const after = view.getUint32(ptr + size, true);
  
  if (before !== CANARY || after !== CANARY) {
    console.error(`Buffer overflow detected at ${ptr}`);
    return false;
  }
  return true;
}
```

## Memory Patterns in Practice

### Request-Response Pattern

```typescript
class RequestBuffer {
  private requestPtr: number;
  private responsePtr: number;
  private maxSize: number;
  
  constructor(memory: WebAssembly.Memory, base: number, maxSize: number) {
    this.requestPtr = base;
    this.responsePtr = base + maxSize;
    this.maxSize = maxSize;
  }
  
  async process(request: Uint8Array): Promise<Uint8Array> {
    if (request.length > this.maxSize) {
      throw new Error("Request too large");
    }
    
    // Write request
    new Uint8Array(memory.buffer).set(request, this.requestPtr);
    
    // Process
    const responseLen = wasmProcess(
      this.requestPtr, request.length,
      this.responsePtr, this.maxSize
    );
    
    // Read response
    return new Uint8Array(memory.buffer, this.responsePtr, responseLen).slice();
  }
}
```

### Double Buffering

For streaming or animation:

```typescript
class DoubleBuffer {
  private buffers: [number, number];
  private current = 0;
  
  constructor(arena: MemoryArena, size: number) {
    this.buffers = [
      arena.alloc(size),
      arena.alloc(size),
    ];
  }
  
  front(): number {
    return this.buffers[this.current];
  }
  
  back(): number {
    return this.buffers[1 - this.current];
  }
  
  swap(): void {
    this.current = 1 - this.current;
  }
}
```

Memory management is where WASM development differs most from typical JavaScript. Master these patterns and you'll handle any data exchange scenario.
