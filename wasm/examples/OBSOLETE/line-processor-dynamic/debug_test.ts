import { DynamicLineProcessor, loadDynamicWasm } from "./test_dynamic.ts";

async function smallTest() {
  console.log("=== Small Dynamic Memory Test ===\n");
  
  const wasmInstance = await loadDynamicWasm();
  const processor = new DynamicLineProcessor(wasmInstance);
  
  console.log(`Initial memory: ${(processor.getMemorySize() / (1024 * 1024)).toFixed(1)}MB`);
  console.log(`Initial heap usage: ${processor.getHeapUsage()} bytes\n`);
  
  // Test with very simple data
  const testChunks = [
    "Line 1\nLine 2\nPartial",
    " continues\nLine 4\n"
  ];
  
  for (let i = 0; i < testChunks.length; i++) {
    console.log(`Processing chunk ${i + 1}: "${testChunks[i]}"`);
    const data = new TextEncoder().encode(testChunks[i]);
    
    console.log(`  Input size: ${data.length} bytes`);
    console.log(`  Heap before: ${processor.getHeapUsage()} bytes`);
    
    try {
      const lines = processor.processChunk(data);
      const leftoverSize = processor.getLeftoverSize();
      const heapAfter = processor.getHeapUsage();
      
      console.log(`  Heap after: ${heapAfter} bytes`);
      console.log(`  Lines found: ${lines.length}`);
      console.log(`  Leftover: ${leftoverSize} bytes`);
      
      lines.forEach((line, j) => {
        const text = new TextDecoder().decode(line);
        console.log(`    Line ${j + 1}: "${text}"`);
      });
      
    } catch (error) {
      console.error(`  Error: ${error}`);
      console.log(`  Heap at error: ${processor.getHeapUsage()} bytes`);
    }
    
    console.log();
  }
  
  // Test memory growth with larger data
  console.log("Testing with larger chunks...");
  for (let size of [1024, 10240, 102400]) {
    const largeData = new Uint8Array(size).fill('A'.charCodeAt(0));
    largeData[size - 1] = '\n'.charCodeAt(0); // End with newline
    
    console.log(`Processing ${size} byte chunk...`);
    console.log(`  Heap before: ${processor.getHeapUsage()} bytes`);
    
    try {
      const lines = processor.processChunk(largeData);
      console.log(`  Heap after: ${processor.getHeapUsage()} bytes`);
      console.log(`  Lines: ${lines.length}, First line length: ${lines[0]?.length || 0}`);
    } catch (error) {
      console.error(`  Error with ${size} bytes: ${error}`);
      break;
    }
  }
}

if (import.meta.main) {
  smallTest().catch(console.error);
}
