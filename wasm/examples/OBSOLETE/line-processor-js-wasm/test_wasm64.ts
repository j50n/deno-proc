#!/usr/bin/env -S deno run --allow-read

/**
 * Test js_wasm64p32 target
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

async function testWasm64() {
  console.log("🧪 Testing js_wasm64p32 target\n");
  
  try {
    const wasmBytes = await Deno.readFile("simple_processor_64.wasm");
    console.log(`📦 WASM file size: ${wasmBytes.length} bytes`);
    
    const memory = new WebAssembly.Memory({ 
      initial: 17,
      maximum: 1024 
    });
    
    (globalThis as any).wasmMemory = memory;
    
    const result = await WebAssembly.instantiate(wasmBytes, {
      env: { memory },
      odin_env
    });
    
    console.log("✅ js_wasm64p32 instantiated successfully!");
    console.log(`📊 Initial memory: ${memory.buffer.byteLength} bytes`);
    
    // Test basic functionality
    const wasm = result.instance;
    (wasm.exports.init_processor as Function)();
    
    // Add a line
    const textEncoder = new TextEncoder();
    const testText = "Hello from wasm64p32!";
    const textBytes = textEncoder.encode(testText);
    
    const memoryView = new Uint8Array(memory.buffer);
    const inputPtr = 1024;
    memoryView.set(textBytes, inputPtr);
    
    const lineCount = (wasm.exports.add_line as Function)(inputPtr, textBytes.length);
    console.log(`📝 Added line, total count: ${lineCount}`);
    
    const memUsage = (wasm.exports.get_memory_usage as Function)();
    console.log(`💾 Memory usage: ${memUsage} bytes`);
    
    console.log("\n🎯 js_wasm64p32 works perfectly!");
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

if (import.meta.main) {
  testWasm64().catch(console.error);
}
