import { DynamicLineProcessor, loadDynamicWasm } from "./test_dynamic.ts";

function generateRandomText(size: number): Uint8Array {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t";
  const result = new Uint8Array(size);
  
  for (let i = 0; i < size; i++) {
    if (Math.random() < 0.05) { // 5% chance of newline
      result[i] = '\n'.charCodeAt(0);
    } else if (Math.random() < 0.02) { // 2% chance of \r\n
      if (i < size - 1) {
        result[i] = '\r'.charCodeAt(0);
        result[i + 1] = '\n'.charCodeAt(0);
        i++; // Skip next position
      } else {
        result[i] = '\n'.charCodeAt(0);
      }
    } else {
      result[i] = chars.charCodeAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return result;
}

async function stressTest() {
  console.log("=== Dynamic Allocator Stress Test ===\n");
  
  const wasmInstance = await loadDynamicWasm();
  const processor = new DynamicLineProcessor(wasmInstance);
  
  const totalSize = 100 * 1024 * 1024; // 100MB
  const chunkSize = 100 * 1024; // 100KB chunks
  const numChunks = Math.ceil(totalSize / chunkSize);
  
  console.log(`Generating ${totalSize / (1024 * 1024)}MB of random text data...`);
  console.log(`Processing in ${numChunks} chunks of ${chunkSize / 1024}KB each\n`);
  
  let totalLinesProcessed = 0;
  let totalBytesProcessed = 0;
  let maxLeftoverSize = 0;
  
  const startTime = performance.now();
  
  try {
    for (let i = 0; i < numChunks; i++) {
      // Generate random chunk
      const actualChunkSize = Math.min(chunkSize, totalSize - i * chunkSize);
      const chunk = generateRandomText(actualChunkSize);
      
      // Process chunk
      const lines = processor.processChunk(chunk);
      const leftoverSize = processor.getLeftoverSize();
      const heapUsage = processor.getHeapUsage();
      const memorySize = processor.getMemorySize();
      
      totalLinesProcessed += lines.length;
      totalBytesProcessed += actualChunkSize;
      maxLeftoverSize = Math.max(maxLeftoverSize, leftoverSize);
      
      // Progress reporting with memory stats
      if ((i + 1) % 100 === 0 || i === numChunks - 1) {
        const progress = ((i + 1) / numChunks * 100).toFixed(1);
        const mbProcessed = (totalBytesProcessed / (1024 * 1024)).toFixed(1);
        const heapMB = (heapUsage / (1024 * 1024)).toFixed(2);
        const totalMB = (memorySize / (1024 * 1024)).toFixed(1);
        console.log(`Progress: ${progress}% (${mbProcessed}MB) - Lines: ${totalLinesProcessed}, Leftover: ${leftoverSize}b, Heap: ${heapMB}/${totalMB}MB`);
      }
      
      // Check for memory issues
      if (leftoverSize > 1024 * 1024) { // If leftover > 1MB, something might be wrong
        console.warn(`Warning: Large leftover buffer detected: ${leftoverSize} bytes`);
      }
    }
    
    // Flush final leftover data
    console.log("\nFlushing final leftover data...");
    const finalLines = processor.flushLeftover();
    totalLinesProcessed += finalLines.length;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log("\n=== Results ===");
    console.log(`✅ Successfully processed ${totalBytesProcessed / (1024 * 1024)}MB`);
    console.log(`✅ Total lines processed: ${totalLinesProcessed}`);
    console.log(`✅ Max leftover size: ${maxLeftoverSize} bytes`);
    console.log(`✅ Processing time: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`✅ Throughput: ${(totalBytesProcessed / (1024 * 1024) / (duration / 1000)).toFixed(2)} MB/s`);
    console.log(`✅ Lines per second: ${(totalLinesProcessed / (duration / 1000)).toFixed(0)}`);
    
    // Test memory state
    console.log("\n=== Memory State Check ===");
    const finalLeftover = processor.getLeftoverSize();
    console.log(`Final leftover size: ${finalLeftover} bytes`);
    
    // Try a small test after the stress test
    console.log("\nTesting processor after stress test...");
    processor.reset();
    const testChunk = new TextEncoder().encode("Test line 1\nTest line 2\n");
    const testResult = processor.processChunk(testChunk);
    console.log(`Post-stress test: ${testResult.length} lines processed`);
    testResult.forEach((line, i) => {
      const text = new TextDecoder().decode(line);
      console.log(`  Line ${i + 1}: "${text}"`);
    });
    
  } catch (error) {
    console.error("❌ Stress test failed:", error);
    
    // Try to get some diagnostic info
    try {
      const leftoverSize = processor.getLeftoverSize();
      console.log(`Leftover size at failure: ${leftoverSize} bytes`);
    } catch (e) {
      console.log("Could not get leftover size:", e);
    }
  }
}

async function main() {
  await stressTest();
}

if (import.meta.main) {
  main().catch(console.error);
}
