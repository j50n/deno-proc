export async function loadJsWasm(): Promise<WebAssembly.Instance> {
  const wasmBytes = await Deno.readFile("./line_processor_js_wasm.wasm");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  
  // js_wasm32 requires odin_env imports
  const imports = {
    odin_env: {
      // Basic write function (for console output)
      write: (fd: number, ptr: number, len: number) => {
        if (fd === 1 || fd === 2) { // stdout/stderr
          const memory = wasmInstance.exports.memory as WebAssembly.Memory;
          const bytes = new Uint8Array(memory.buffer, ptr, len);
          const text = new TextDecoder().decode(bytes);
          console.log(text);
        }
        return len;
      },
      
      // Random number generation
      rand_bytes: (ptr: number, len: number) => {
        const memory = wasmInstance.exports.memory as WebAssembly.Memory;
        const bytes = new Uint8Array(memory.buffer, ptr, len);
        crypto.getRandomValues(bytes);
      },
      
      // Time functions
      time_now: () => Date.now() * 1000000, // nanoseconds
      
      // Additional math functions
      pow: Math.pow,
      exp: Math.exp,
      log: Math.log,
      floor: Math.floor,
      ceil: Math.ceil,
      
      // Memory allocation functions (simplified)
      default_allocator_proc: (allocator_data: number, mode: number, size: number, alignment: number, old_memory: number, old_size: number) => {
        const memory = wasmInstance.exports.memory as WebAssembly.Memory;
        
        if (mode === 0) { // Alloc
          // Grow memory if needed
          const currentSize = memory.buffer.byteLength;
          const needed = size + 1024; // Add some padding
          
          if (currentSize < needed) {
            const pagesNeeded = Math.ceil((needed - currentSize) / 65536);
            memory.grow(pagesNeeded);
          }
          
          // Simple bump allocator - just return current end of memory
          // This is very simplified - real allocator would track free blocks
          return currentSize;
        }
        
        return 0; // Free/other operations
      },
      
      // Panic handler
      default_assertion_failure_proc: (prefix_ptr: number, prefix_len: number, message_ptr: number, message_len: number, file_ptr: number, file_len: number, line: number, column: number) => {
        const memory = wasmInstance.exports.memory as WebAssembly.Memory;
        const bytes = new Uint8Array(memory.buffer);
        
        const prefix = new TextDecoder().decode(bytes.slice(prefix_ptr, prefix_ptr + prefix_len));
        const message = new TextDecoder().decode(bytes.slice(message_ptr, message_ptr + message_len));
        const file = new TextDecoder().decode(bytes.slice(file_ptr, file_ptr + file_len));
        
        console.error(`${prefix}: ${message} at ${file}:${line}:${column}`);
        throw new Error(`Odin assertion failed: ${message}`);
      }
    }
  };
  
  const wasmInstance = await WebAssembly.instantiate(wasmModule, imports);
  return wasmInstance;
}

async function testJsWasmAllocator() {
  console.log("=== js_wasm32 Allocator Experiment ===\n");
  
  try {
    const wasmInstance = await loadJsWasm();
    
    console.log("WASM instance loaded successfully!");
    console.log(`Memory size: ${(wasmInstance.exports.memory as WebAssembly.Memory).buffer.byteLength} bytes`);
    
    // Test simple allocation
    console.log("\n1. Testing simple allocation...");
    const ptr = (wasmInstance.exports.simple_alloc_test as Function)(1024);
    console.log(`Allocated 1024 bytes at pointer: ${ptr}`);
    
    // Check stats
    let stats = (wasmInstance.exports.get_allocation_stats as Function)();
    const allocCount = Number(stats >> 32n);
    const netAllocated = Number(stats & 0xFFFFFFFFn);
    console.log(`Stats: ${allocCount} allocations, ${netAllocated} net bytes`);
    
    // Test stress test
    console.log("\n2. Testing stress allocations...");
    const successful = (wasmInstance.exports.stress_test as Function)(100, 1024);
    console.log(`Successful allocations: ${successful}/100`);
    
    // Check final stats
    stats = (wasmInstance.exports.get_allocation_stats as Function)();
    const finalAllocCount = Number(stats >> 32n);
    const finalNetAllocated = Number(stats & 0xFFFFFFFFn);
    console.log(`Final stats: ${finalAllocCount} allocations, ${finalNetAllocated} net bytes`);
    
    // Test larger allocations
    console.log("\n3. Testing large allocations...");
    const largeSuccessful = (wasmInstance.exports.stress_test as Function)(10, 1024 * 1024);
    console.log(`Large allocations successful: ${largeSuccessful}/10`);
    
  } catch (error) {
    console.error("Failed to test js_wasm32 allocator:", error);
    console.log("\nThis is expected - js_wasm32 needs a proper runtime environment");
    console.log("The allocator calls into JavaScript APIs that we haven't implemented");
  }
}

export async function compareFileSizes() {
  console.log("\n=== File Size Comparison ===");
  
  try {
    const freestandingSize = (await Deno.stat("../line-processor/line_processor.wasm")).size;
    const jsWasmSize = (await Deno.stat("./line_processor_js_wasm.wasm")).size;
    
    console.log(`freestanding_wasm32: ${freestandingSize} bytes`);
    console.log(`js_wasm32:          ${jsWasmSize} bytes`);
    console.log(`Difference:         ${jsWasmSize - freestandingSize} bytes (${((jsWasmSize / freestandingSize - 1) * 100).toFixed(1)}% larger)`);
    
  } catch (error) {
    console.log("Could not compare file sizes:", error.message);
  }
}

async function main() {
  await testJsWasmAllocator();
  await compareFileSizes();
}

if (import.meta.main) {
  main().catch(console.error);
}
