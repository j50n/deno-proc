import { LineProcessor, loadWasm } from "../line-processor/test.ts";

function generateRandomText(size: number, maxLineLength: number = 1000): Uint8Array {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 \t";
  const result = new Uint8Array(size);
  let pos = 0;
  
  while (pos < size) {
    // Generate a line of random length (up to maxLineLength)
    const lineLength = Math.floor(Math.random() * maxLineLength) + 1;
    const actualLength = Math.min(lineLength, size - pos - 1); // Leave room for \n
    
    // Fill line with random characters
    for (let i = 0; i < actualLength; i++) {
      result[pos + i] = chars.charCodeAt(Math.floor(Math.random() * chars.length));
    }
    
    // Add line ending
    if (pos + actualLength < size) {
      if (Math.random() < 0.1) { // 10% chance of \r\n
        result[pos + actualLength] = '\r'.charCodeAt(0);
        if (pos + actualLength + 1 < size) {
          result[pos + actualLength + 1] = '\n'.charCodeAt(0);
          pos += actualLength + 2;
        } else {
          result[pos + actualLength] = '\n'.charCodeAt(0);
          pos += actualLength + 1;
        }
      } else {
        result[pos + actualLength] = '\n'.charCodeAt(0);
        pos += actualLength + 1;
      }
    } else {
      pos += actualLength;
    }
  }
  
  return result;
}

async function stressTestFixed() {
  console.log("=== Fixed Memory Stress Test ===\n");
  
  const wasmInstance = await loadWasm();
  const processor = new LineProcessor(wasmInstance);
  
  const totalSize = 100 * 1024 * 1024; // 100MB
  const chunkSize = 50 * 1024; // 50KB chunks (well within 64KB buffer)
  const numChunks = Math.ceil(totalSize / chunkSize);
  const maxLineLength = 1000; // Max 1000 chars per line
  
  console.log(`Processing ${totalSize / (1024 * 1024)}MB of random text data...`);
  console.log(`Max line length: ${maxLineLength} characters`);
  console.log(`Using ${numChunks} chunks of ${chunkSize / 1024}KB each\n`);
  
  let totalLinesProcessed = 0;
  let totalBytesProcessed = 0;
  let maxLeftoverSize = 0;
  
  const startTime = performance.now();
  
  try {
    for (let i = 0; i < numChunks; i++) {
      // Generate random chunk with controlled line lengths
      const actualChunkSize = Math.min(chunkSize, totalSize - i * chunkSize);
      const chunk = generateRandomText(actualChunkSize, maxLineLength);
      
      // Process chunk
      const result = processor.processChunk(chunk);
      const leftoverSize = result.leftoverLen;
      
      totalLinesProcessed += result.lines.length;
      totalBytesProcessed += actualChunkSize;
      maxLeftoverSize = Math.max(maxLeftoverSize, leftoverSize);
      
      // Progress reporting
      if ((i + 1) % 200 === 0 || i === numChunks - 1) {
        const progress = ((i + 1) / numChunks * 100).toFixed(1);
        const mbProcessed = (totalBytesProcessed / (1024 * 1024)).toFixed(1);
        console.log(`Progress: ${progress}% (${mbProcessed}MB) - Lines: ${totalLinesProcessed}, Leftover: ${leftoverSize} bytes`);
      }
      
      // Verify leftover is reasonable
      if (leftoverSize > maxLineLength + 10) {
        console.warn(`Warning: Leftover size (${leftoverSize}) exceeds expected max line length`);
      }
      
      // Verify some lines to make sure they're reasonable
      if (i === 0) {
        console.log("Sample lines from first chunk:");
        result.lines.slice(0, 3).forEach((line, idx) => {
          const text = new TextDecoder().decode(line);
          console.log(`  Line ${idx + 1}: "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}" (${line.length} chars)`);
        });
        console.log();
      }
    }
    
    // Flush final leftover data
    console.log("\nFlushing final leftover data...");
    const finalResult = processor.processChunk(new Uint8Array(0));
    totalLinesProcessed += finalResult.lines.length;
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log("\n=== Results ===");
    console.log(`✅ Successfully processed ${totalBytesProcessed / (1024 * 1024)}MB`);
    console.log(`✅ Total lines processed: ${totalLinesProcessed}`);
    console.log(`✅ Max leftover size: ${maxLeftoverSize} bytes (should be < ${maxLineLength})`);
    console.log(`✅ Processing time: ${(duration / 1000).toFixed(2)} seconds`);
    console.log(`✅ Throughput: ${(totalBytesProcessed / (1024 * 1024) / (duration / 1000)).toFixed(2)} MB/s`);
    console.log(`✅ Lines per second: ${(totalLinesProcessed / (duration / 1000)).toFixed(0)}`);
    
    // Test memory state
    console.log("\n=== Memory State Check ===");
    const testResult = processor.processChunk(new Uint8Array(0));
    console.log(`Final leftover size: ${testResult.leftoverLen} bytes`);
    
    // Try a small test after the stress test
    console.log("\nTesting processor after stress test...");
    processor.resetLeftover();
    const testChunk = new TextEncoder().encode("Test line 1\nTest line 2\n");
    const postTestResult = processor.processChunk(testChunk);
    console.log(`Post-stress test: ${postTestResult.lines.length} lines processed`);
    postTestResult.lines.forEach((line, i) => {
      const text = new TextDecoder().decode(line);
      console.log(`  Line ${i + 1}: "${text}"`);
    });
    
  } catch (error) {
    console.error("❌ Stress test failed:", error);
    
    // Try to get some diagnostic info
    try {
      const diagResult = processor.processChunk(new Uint8Array(0));
      console.log(`Leftover size at failure: ${diagResult.leftoverLen} bytes`);
    } catch (e) {
      console.log("Could not get leftover size:", e);
    }
  }
}

async function main() {
  await stressTestFixed();
}

if (import.meta.main) {
  main().catch(console.error);
}
