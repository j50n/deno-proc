#!/usr/bin/env -S deno run --allow-read

/**
 * Working js_wasm32 Line Processor Demo
 * 
 * This demonstrates the key concepts of js_wasm32 memory management:
 * 1. WASM can use make/delete for dynamic allocation
 * 2. Memory may grow automatically during WASM execution
 * 3. JavaScript must be aware of memory growth to access new allocations
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

class JsWasmProcessor {
  private wasm!: WebAssembly.Instance;
  private memory!: WebAssembly.Memory;
  private textDecoder = new TextDecoder();
  private textEncoder = new TextEncoder();

  async init() {
    const wasmBytes = await Deno.readFile("simple_processor.wasm");
    
    this.memory = new WebAssembly.Memory({ 
      initial: 17,    // 1MB initial
      maximum: 1024   // 64MB maximum
    });
    
    (globalThis as any).wasmMemory = this.memory;
    
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: { memory: this.memory },
      odin_env
    });
    
    this.wasm = result.instance;
    (this.wasm.exports.init_processor as Function)();
    
    console.log("✅ js_wasm32 Processor initialized");
    console.log(`📊 Initial memory: ${this.memory.buffer.byteLength} bytes`);
  }

  addLine(text: string): number {
    const initialMemory = this.memory.buffer.byteLength;
    
    // Encode and copy to WASM memory for input
    const textBytes = this.textEncoder.encode(text);
    const memoryView = new Uint8Array(this.memory.buffer);
    const inputPtr = 1024;
    
    // Ensure space for input
    if (inputPtr + textBytes.length > memoryView.length) {
      const currentPages = this.memory.buffer.byteLength / 65536;
      const neededPages = Math.ceil((inputPtr + textBytes.length) / 65536);
      if (neededPages > currentPages) {
        this.memory.grow(neededPages - currentPages);
      }
    }
    
    const newMemoryView = new Uint8Array(this.memory.buffer);
    newMemoryView.set(textBytes, inputPtr);
    
    // Call WASM function (this may allocate more memory internally)
    const lineCount = (this.wasm.exports.add_line as Function)(inputPtr, textBytes.length);
    
    // Check if memory grew during the call
    const finalMemory = this.memory.buffer.byteLength;
    if (finalMemory > initialMemory) {
      console.log(`  📈 Memory grew: ${initialMemory} → ${finalMemory} bytes (+${finalMemory - initialMemory})`);
    }
    
    return lineCount;
  }

  getLines(): string[] {
    const count = (this.wasm.exports.get_line_count as Function)();
    const lines: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const linePtr = (this.wasm.exports.get_line as Function)(i);
      const lineLen = (this.wasm.exports.get_line_length as Function)(i);
      
      // Key insight: Check if the pointer is within current memory bounds
      if (linePtr && lineLen > 0 && linePtr + lineLen <= this.memory.buffer.byteLength) {
        const lineBytes = new Uint8Array(this.memory.buffer, linePtr, lineLen);
        const lineText = this.textDecoder.decode(lineBytes);
        lines.push(lineText);
      } else {
        // This would happen if WASM allocated beyond current memory
        // In a real implementation, we might need to trigger memory growth
        lines.push(`[inaccessible: ptr=${linePtr}, len=${lineLen}]`);
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

  getMemoryInfo() {
    return {
      totalBytes: this.memory.buffer.byteLength,
      totalPages: this.memory.buffer.byteLength / 65536,
      wasmUsage: Number(this.getMemoryUsage())
    };
  }
}

async function demonstrateJsWasm32() {
  console.log("🚀 js_wasm32 Memory Management Demo\n");
  
  const processor = new JsWasmProcessor();
  await processor.init();
  
  console.log("📝 Adding lines (each allocation uses WASM's make()):");
  const testLines = [
    "Hello, js_wasm32 world!",
    "This string is allocated with make()",
    "Memory grows automatically as needed",
    "JavaScript can access WASM-allocated memory",
    "This demonstrates dynamic memory management"
  ];
  
  for (const line of testLines) {
    const count = processor.addLine(line);
    const memInfo = processor.getMemoryInfo();
    console.log(`  ✓ "${line}"`);
    console.log(`    Lines: ${count}, WASM usage: ${memInfo.wasmUsage} bytes`);
  }
  
  console.log("\n📋 Retrieving lines (accessing WASM-allocated strings):");
  const retrievedLines = processor.getLines();
  retrievedLines.forEach((line, i) => {
    console.log(`  ${i + 1}: "${line}"`);
  });
  
  const finalMemInfo = processor.getMemoryInfo();
  console.log(`\n💾 Final memory state:`);
  console.log(`  Total memory: ${finalMemInfo.totalBytes} bytes (${finalMemInfo.totalPages} pages)`);
  console.log(`  WASM usage: ${finalMemInfo.wasmUsage} bytes`);
  console.log(`  Efficiency: ${(finalMemInfo.wasmUsage / finalMemInfo.totalBytes * 100).toFixed(1)}%`);
  
  console.log("\n🧹 Cleaning up (calling delete() on all strings):");
  processor.clear();
  const cleanMemInfo = processor.getMemoryInfo();
  console.log(`  WASM usage after cleanup: ${cleanMemInfo.wasmUsage} bytes`);
  console.log(`  Total memory remains: ${cleanMemInfo.totalBytes} bytes (memory doesn't shrink)`);
  
  console.log("\n🎯 Key Insights:");
  console.log("  • WASM can use make/delete for dynamic allocation");
  console.log("  • Memory grows automatically when WASM needs more space");
  console.log("  • JavaScript can access WASM-allocated memory through pointers");
  console.log("  • Memory doesn't shrink after delete() - it's reused");
  console.log("  • This provides familiar programming model at cost of size/complexity");
}

if (import.meta.main) {
  demonstrateJsWasm32().catch(console.error);
}

export { JsWasmProcessor };
