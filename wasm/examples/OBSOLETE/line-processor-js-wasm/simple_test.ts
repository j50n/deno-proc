#!/usr/bin/env -S deno run --allow-read

/**
 * Simple test of js_wasm32 memory management
 */

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
    const memory = new Uint8Array((globalThis as any).wasmMemory?.buffer || new ArrayBuffer(0));
    if (ptr + len <= memory.length) {
      for (let i = 0; i < len; i++) {
        memory[ptr + i] = Math.floor(Math.random() * 256);
      }
    }
  },
};

class SimpleProcessor {
  private wasm!: WebAssembly.Instance;
  private memory!: WebAssembly.Memory;
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  async init() {
    const wasmBytes = await Deno.readFile("simple_processor.wasm");
    
    this.memory = new WebAssembly.Memory({ 
      initial: 17,
      maximum: 1024 
    });
    
    (globalThis as any).wasmMemory = this.memory;
    
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: { memory: this.memory },
      odin_env
    });
    
    this.wasm = result.instance;
    (this.wasm.exports.init_processor as Function)();
    
    console.log("✅ Simple processor initialized");
  }

  addLine(text: string): number {
    const textBytes = this.textEncoder.encode(text);
    
    // Copy to WASM memory
    const memoryView = new Uint8Array(this.memory.buffer);
    const ptr = 1024;
    
    if (ptr + textBytes.length > memoryView.length) {
      const currentPages = this.memory.buffer.byteLength / 65536;
      const neededPages = Math.ceil((ptr + textBytes.length) / 65536);
      if (neededPages > currentPages) {
        this.memory.grow(neededPages - currentPages);
      }
    }
    
    const newMemoryView = new Uint8Array(this.memory.buffer);
    newMemoryView.set(textBytes, ptr);
    
    return (this.wasm.exports.add_line as Function)(ptr, textBytes.length);
  }

  getLines(): string[] {
    const count = (this.wasm.exports.get_line_count as Function)();
    const lines: string[] = [];
    
    console.log(`  Debug: ${count} lines to retrieve, memory: ${this.memory.buffer.byteLength} bytes`);
    
    for (let i = 0; i < count; i++) {
      const linePtr = (this.wasm.exports.get_line as Function)(i);
      const lineLen = (this.wasm.exports.get_line_length as Function)(i);
      
      console.log(`  Debug: Line ${i}: ptr=${linePtr}, len=${lineLen}`);
      
      // Check if memory grew and we need to refresh our view
      if (linePtr >= this.memory.buffer.byteLength) {
        console.log(`  Debug: Pointer outside memory, checking for growth...`);
        console.log(`  Debug: Memory is now ${this.memory.buffer.byteLength} bytes`);
      }
      
      if (linePtr && lineLen > 0 && linePtr + lineLen <= this.memory.buffer.byteLength) {
        const lineBytes = new Uint8Array(this.memory.buffer, linePtr, lineLen);
        const lineText = this.textDecoder.decode(lineBytes);
        lines.push(lineText);
      } else {
        console.log(`  Debug: Invalid line ${i} - ptr=${linePtr}, len=${lineLen}, would read until ${linePtr + lineLen}, memory=${this.memory.buffer.byteLength}`);
        lines.push(`[invalid line ${i}]`);
      }
    }
    
    return lines;
  }

  clear() {
    (this.wasm.exports.clear_lines as Function)();
  }

  getMemoryUsage(): bigint {
    return (this.wasm.exports.get_memory_usage as Function)();
  }
}

async function runTest() {
  console.log("🧪 Simple js_wasm32 Test\n");
  
  const processor = new SimpleProcessor();
  await processor.init();
  
  // Add some lines
  console.log("📝 Adding lines:");
  const testLines = ["Hello World", "Second Line", "Third Line"];
  
  for (const line of testLines) {
    const count = processor.addLine(line);
    console.log(`  Added "${line}" -> ${count} total lines`);
  }
  
  // Get all lines back
  console.log("\n📋 Retrieved lines:");
  const lines = processor.getLines();
  lines.forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
  });
  
  console.log(`\n💾 Memory usage: ${processor.getMemoryUsage()} bytes`);
  
  // Clear and test again
  console.log("\n🧹 Clearing...");
  processor.clear();
  console.log(`Lines after clear: ${processor.getLines().length}`);
  console.log(`Memory after clear: ${processor.getMemoryUsage()} bytes`);
}

if (import.meta.main) {
  runTest().catch(console.error);
}
