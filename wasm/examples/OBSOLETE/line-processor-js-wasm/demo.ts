#!/usr/bin/env -S deno run --allow-read

/**
 * Demo of js_wasm32 Line Processor
 * 
 * This demonstrates how WASM modules built with js_wasm32 can use
 * dynamic memory allocation (make/delete) internally while still
 * interfacing cleanly with JavaScript.
 */

// Simple odin_env runtime for js_wasm32
const odin_env = {
  write: (fd: number, ptr: number, len: number) => len,
  trap: () => { throw new Error("WASM trap"); },
  alert: (ptr: number, len: number) => {},
  abort: () => { throw new Error("WASM abort"); },
  evaluate: (str_ptr: number, str_len: number) => 0,
  time_now: () => BigInt(Date.now() * 1000000),
  tick_now: () => BigInt(performance.now() * 1000000),
  time_sleep: (duration: bigint) => {},
  sqrt: Math.sqrt,
  sin: Math.sin,
  cos: Math.cos,
  pow: Math.pow,
  fmuladd: (a: number, b: number, c: number) => a * b + c,
  ln: Math.log,
  exp: Math.exp,
  ldexp: (x: number, exp: number) => x * Math.pow(2, exp),
  rand_bytes: (ptr: number, len: number) => {
    // Fill with random bytes
    const memory = new Uint8Array((globalThis as any).wasmMemory?.buffer || new ArrayBuffer(0));
    if (ptr + len <= memory.length) {
      for (let i = 0; i < len; i++) {
        memory[ptr + i] = Math.floor(Math.random() * 256);
      }
    }
  },
};

class JsWasmLineProcessor {
  private wasm!: WebAssembly.Instance;
  private memory!: WebAssembly.Memory;
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  async init() {
    const wasmBytes = await Deno.readFile("line_processor_js_wasm.wasm");
    
    // Create memory that can grow
    this.memory = new WebAssembly.Memory({ 
      initial: 17,  // 1MB initial
      maximum: 1024 // 64MB max
    });
    
    // Make memory available to odin_env
    (globalThis as any).wasmMemory = this.memory;
    
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: { memory: this.memory },
      odin_env
    });
    
    this.wasm = result.instance;
    
    // Initialize the processor
    (this.wasm.exports.init_processor as Function)();
    
    console.log("✅ js_wasm32 Line Processor initialized");
    console.log(`📊 Initial memory: ${this.memory.buffer.byteLength} bytes`);
  }

  processChunk(text: string): number {
    // Encode text to bytes
    const inputBytes = this.textEncoder.encode(text);
    
    // Debug: check JavaScript side
    let jsNewlines = 0;
    for (let i = 0; i < inputBytes.length; i++) {
      if (inputBytes[i] === 10) jsNewlines++; // \n is ASCII 10
    }
    console.log(`  Debug JS: "${text}" -> [${Array.from(inputBytes).join(',')}], ${jsNewlines} newlines`);
    
    // Copy data directly into WASM memory at a safe location
    const memoryView = new Uint8Array(this.memory.buffer);
    const inputPtr = 1024; // Use fixed location for input
    
    // Ensure we have enough space
    if (inputPtr + inputBytes.length > memoryView.length) {
      // Grow memory if needed
      const currentPages = this.memory.buffer.byteLength / 65536;
      const neededPages = Math.ceil((inputPtr + inputBytes.length) / 65536);
      if (neededPages > currentPages) {
        this.memory.grow(neededPages - currentPages);
      }
    }
    
    // Copy data into WASM memory
    const newMemoryView = new Uint8Array(this.memory.buffer);
    newMemoryView.set(inputBytes, inputPtr);
    
    // Debug: verify what's in memory after copy
    const copiedBytes = newMemoryView.slice(inputPtr, inputPtr + inputBytes.length);
    let copiedNewlines = 0;
    for (let i = 0; i < copiedBytes.length; i++) {
      if (copiedBytes[i] === 10) copiedNewlines++;
    }
    console.log(`  Debug Memory: [${Array.from(copiedBytes).join(',')}], ${copiedNewlines} newlines`);
    
    // Debug: check what WASM sees
    const debugNewlines = (this.wasm.exports.debug_input as Function)(inputPtr, inputBytes.length);
    console.log(`  Debug WASM: ${debugNewlines} newlines detected`);
    
    // Process the chunk
    const lineCount = (this.wasm.exports.process_chunk as Function)(
      inputPtr, 
      inputBytes.length
    );
    
    return lineCount;
  }

  getLines(): string[] {
    const count = (this.wasm.exports.get_line_count as Function)();
    const lines: string[] = [];
    
    console.log(`  Debug: Getting ${count} lines`);
    
    for (let i = 0; i < count; i++) {
      const linePtr = (this.wasm.exports.get_line as Function)(i);
      const lineLen = (this.wasm.exports.get_line_length as Function)(i);
      
      console.log(`  Debug: Line ${i}: ptr=${linePtr}, len=${lineLen}`);
      
      if (linePtr && lineLen > 0 && linePtr < this.memory.buffer.byteLength) {
        const lineBytes = new Uint8Array(this.memory.buffer, linePtr, lineLen);
        const lineText = this.textDecoder.decode(lineBytes);
        lines.push(lineText);
      } else {
        console.log(`  Debug: Skipping invalid line ${i}`);
        lines.push(`[invalid line ${i}]`);
      }
    }
    
    return lines;
  }

  clearOutput() {
    (this.wasm.exports.clear_output as Function)();
  }

  flushLeftover(): number {
    return (this.wasm.exports.flush_leftover as Function)();
  }

  getMemoryUsage(): bigint {
    return (this.wasm.exports.get_memory_usage as Function)();
  }

  private allocateBuffer(data: Uint8Array): number {
    // Use WASM's own allocator instead of manual memory management
    const allocFn = this.wasm.exports.simple_alloc_test as Function;
    if (!allocFn) {
      throw new Error("WASM allocator not available");
    }
    
    // Allocate buffer in WASM
    const ptr = allocFn(data.length);
    
    // Copy data into allocated buffer
    const memoryView = new Uint8Array(this.memory.buffer);
    memoryView.set(data, ptr);
    
    return ptr;
  }

  private freeBuffer(ptr: number, size: number) {
    // For this demo, we rely on WASM's internal cleanup
    // In a real implementation, we'd call a WASM free function
  }
}

// Demo function
async function runDemo() {
  console.log("🚀 js_wasm32 Line Processor Demo\n");
  
  const processor = new JsWasmLineProcessor();
  await processor.init();
  
  // Test data with various line endings
  const testData = [
    "First line\n",
    "Second line\r\n", 
    "Third line without ending",
    "\nFourth line\n",
    "Fifth line\r\nSixth line\n"
  ];
  
  console.log("📝 Processing chunks:");
  
  for (let i = 0; i < testData.length; i++) {
    const chunk = testData[i];
    console.log(`  Chunk ${i + 1}: ${JSON.stringify(chunk)}`);
    
    const lineCount = processor.processChunk(chunk);
    const memUsage = processor.getMemoryUsage();
    
    console.log(`    → Lines so far: ${lineCount}, Memory: ${memUsage} bytes`);
  }
  
  // Flush any remaining data
  console.log("\n🔄 Flushing leftover data...");
  const finalCount = processor.flushLeftover();
  
  // Get all lines
  const lines = processor.getLines();
  
  console.log(`\n📋 Final Results (${finalCount} lines):`);
  lines.forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
  });
  
  console.log(`\n💾 Final memory usage: ${processor.getMemoryUsage()} bytes`);
  console.log(`📏 WASM memory size: ${processor['memory'].buffer.byteLength} bytes`);
  
  // Demonstrate memory cleanup
  console.log("\n🧹 Clearing output...");
  processor.clearOutput();
  console.log(`💾 Memory after cleanup: ${processor.getMemoryUsage()} bytes`);
}

if (import.meta.main) {
  runDemo().catch(console.error);
}

export { JsWasmLineProcessor };
