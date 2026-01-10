import { LineProcessor, loadWasm } from "./test.ts";

async function streamingTest() {
  console.log("=== Streaming Line Processor Test ===\n");
  
  const wasmInstance = await loadWasm();
  const processor = new LineProcessor(wasmInstance);

  // Simulate streaming data with various chunk boundaries
  const chunks = [
    "Line 1\nLine 2\nPartial",
    " line continues\nLine 4\r\nLine 5 with",
    " more data\nLine 6\n\nEmpty line above\nFinal"
  ];

  let totalLines = 0;
  
  for (let i = 0; i < chunks.length; i++) {
    console.log(`Processing chunk ${i + 1}: "${chunks[i]}"`);
    const data = new TextEncoder().encode(chunks[i]);
    const result = processor.processChunk(data);
    
    console.log(`  → Found ${result.lines.length} complete lines`);
    console.log(`  → Leftover bytes: ${result.leftoverLen}`);
    
    result.lines.forEach((line, j) => {
      const text = new TextDecoder().decode(line);
      totalLines++;
      console.log(`    Line ${totalLines}: "${text}" (${line.length} bytes)`);
    });
    console.log();
  }

  // Process final chunk to flush any remaining data
  console.log("Flushing remaining data with empty chunk...");
  const finalResult = processor.processChunk(new Uint8Array(0));
  if (finalResult.lines.length > 0) {
    finalResult.lines.forEach((line) => {
      const text = new TextDecoder().decode(line);
      totalLines++;
      console.log(`    Final line: "${text}" (${line.length} bytes)`);
    });
  }
  
  console.log(`\nTotal lines processed: ${totalLines}`);
}

async function performanceTest() {
  console.log("\n=== Performance Test ===\n");
  
  const wasmInstance = await loadWasm();
  const processor = new LineProcessor(wasmInstance);

  // Generate test data
  const testLines = Array.from({ length: 1000 }, (_, i) => 
    `This is test line number ${i + 1} with some additional content to make it longer`
  );
  const testData = new TextEncoder().encode(testLines.join('\n') + '\n');
  
  console.log(`Test data: ${testData.length} bytes, ${testLines.length} lines`);
  
  // Process in chunks
  const chunkSize = 8192; // 8KB chunks
  const chunks = [];
  for (let i = 0; i < testData.length; i += chunkSize) {
    chunks.push(testData.slice(i, i + chunkSize));
  }
  
  console.log(`Processing ${chunks.length} chunks of ~${chunkSize} bytes each...`);
  
  const startTime = performance.now();
  let totalLinesProcessed = 0;
  
  for (const chunk of chunks) {
    const result = processor.processChunk(chunk);
    totalLinesProcessed += result.lines.length;
  }
  
  // Flush final data
  const finalResult = processor.processChunk(new Uint8Array(0));
  totalLinesProcessed += finalResult.lines.length;
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`Processed ${totalLinesProcessed} lines in ${duration.toFixed(2)}ms`);
  console.log(`Throughput: ${(testData.length / 1024 / 1024 / (duration / 1000)).toFixed(2)} MB/s`);
  console.log(`Lines per second: ${(totalLinesProcessed / (duration / 1000)).toFixed(0)}`);
}

async function main() {
  await streamingTest();
  await performanceTest();
}

if (import.meta.main) {
  main().catch(console.error);
}
