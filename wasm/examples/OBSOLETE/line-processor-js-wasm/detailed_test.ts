import { loadJsWasm, compareFileSizes } from "./test_js_wasm.ts";

async function detailedAllocatorTest() {
  console.log("=== Detailed js_wasm32 Allocator Analysis ===\n");
  
  const wasmInstance = await loadJsWasm();
  const memory = wasmInstance.exports.memory as WebAssembly.Memory;
  
  console.log(`Initial memory: ${memory.buffer.byteLength} bytes`);
  
  // Test 1: Simple allocations
  console.log("\n1. Simple allocations:");
  for (let size of [100, 1000, 10000]) {
    (wasmInstance.exports.reset_stats as Function)();
    
    const ptr = (wasmInstance.exports.simple_alloc_test as Function)(size);
    const stats = (wasmInstance.exports.get_allocation_stats as Function)();
    const allocCount = Number(stats >> 32n);
    const netBytes = Number(stats & 0xFFFFFFFFn);
    
    console.log(`  ${size} bytes -> ptr: ${ptr}, stats: ${allocCount} allocs, ${netBytes} net bytes`);
  }
  
  // Test 2: Memory growth
  console.log("\n2. Memory growth test:");
  const initialSize = memory.buffer.byteLength;
  
  // Allocate something larger than current memory
  const largeSize = 2 * 1024 * 1024; // 2MB
  console.log(`Allocating ${largeSize} bytes...`);
  
  const largePtr = (wasmInstance.exports.simple_alloc_test as Function)(largeSize);
  const newSize = memory.buffer.byteLength;
  
  console.log(`  Memory grew from ${initialSize} to ${newSize} bytes`);
  console.log(`  Large allocation at ptr: ${largePtr}`);
  
  // Test 3: Allocation/deallocation patterns
  console.log("\n3. Allocation patterns:");
  (wasmInstance.exports.reset_stats as Function)();
  
  // Allocate many small buffers
  const ptrs: number[] = [];
  for (let i = 0; i < 50; i++) {
    const ptr = (wasmInstance.exports.simple_alloc_test as Function)(1024);
    ptrs.push(ptr);
  }
  
  let stats = (wasmInstance.exports.get_allocation_stats as Function)();
  console.log(`  After 50 allocations: ${Number(stats >> 32n)} allocs, ${Number(stats & 0xFFFFFFFFn)} net bytes`);
  
  // Free half of them (note: our simple implementation doesn't actually free)
  for (let i = 0; i < 25; i++) {
    (wasmInstance.exports.free_buffer as Function)(ptrs[i], 1024);
  }
  
  stats = (wasmInstance.exports.get_allocation_stats as Function)();
  console.log(`  After freeing 25: ${Number(stats >> 32n)} allocs, ${Number(stats & 0xFFFFFFFFn)} net bytes`);
  
  // Test 4: Stress test with different sizes
  console.log("\n4. Mixed size stress test:");
  (wasmInstance.exports.reset_stats as Function)();
  
  const sizes = [64, 256, 1024, 4096, 16384];
  let totalSuccessful = 0;
  
  for (const size of sizes) {
    const successful = (wasmInstance.exports.stress_test as Function)(20, size);
    totalSuccessful += successful;
    console.log(`  ${size} bytes: ${successful}/20 successful`);
  }
  
  const finalStats = (wasmInstance.exports.get_allocation_stats as Function)();
  console.log(`  Total: ${totalSuccessful} successful, final net bytes: ${Number(finalStats & 0xFFFFFFFFn)}`);
  
  // Test 5: Memory inspection
  console.log("\n5. Memory inspection:");
  const finalMemorySize = memory.buffer.byteLength;
  console.log(`  Final memory size: ${finalMemorySize} bytes (${(finalMemorySize / 1024 / 1024).toFixed(2)} MB)`);
  
  // Look at some memory content
  const bytes = new Uint8Array(memory.buffer);
  console.log(`  First 16 bytes: [${Array.from(bytes.slice(0, 16)).join(', ')}]`);
  console.log(`  Last 16 bytes: [${Array.from(bytes.slice(-16)).join(', ')}]`);
}

// Update main to run detailed test
async function main() {
  await detailedAllocatorTest();
  await compareFileSizes();
}

if (import.meta.main) {
  main().catch(console.error);
}
