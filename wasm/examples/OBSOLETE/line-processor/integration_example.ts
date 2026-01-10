import { LineProcessor, loadWasm } from "./test.ts";

/**
 * Integration example showing how to use WASM line processor
 * with Deno's streaming capabilities for file processing
 */

async function processFileWithWasm(filePath: string) {
  console.log(`Processing file: ${filePath}`);
  
  // Load WASM module
  const wasmInstance = await loadWasm();
  const processor = new LineProcessor(wasmInstance);
  
  // Open file for reading
  const file = await Deno.open(filePath, { read: true });
  const reader = file.readable.getReader();
  
  let totalLines = 0;
  let totalBytes = 0;
  const startTime = performance.now();
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      totalBytes += value.length;
      const result = processor.processChunk(value);
      
      // Process each line
      for (const line of result.lines) {
        totalLines++;
        const text = new TextDecoder().decode(line);
        
        // Example processing: count words in each line
        const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
        console.log(`Line ${totalLines}: ${wordCount} words - "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
      }
    }
    
    // Flush any remaining data
    const finalResult = processor.processChunk(new Uint8Array(0));
    for (const line of finalResult.lines) {
      totalLines++;
      const text = new TextDecoder().decode(line);
      const wordCount = text.trim().split(/\s+/).filter(w => w.length > 0).length;
      console.log(`Line ${totalLines}: ${wordCount} words - "${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"`);
    }
    
  } finally {
    reader.releaseLock();
    file.close();
  }
  
  const endTime = performance.now();
  const duration = endTime - startTime;
  
  console.log(`\nProcessing complete:`);
  console.log(`  Lines: ${totalLines}`);
  console.log(`  Bytes: ${totalBytes}`);
  console.log(`  Time: ${duration.toFixed(2)}ms`);
  console.log(`  Throughput: ${(totalBytes / 1024 / 1024 / (duration / 1000)).toFixed(2)} MB/s`);
}

async function createTestFile() {
  const testContent = [
    "# Test File for WASM Line Processing",
    "",
    "This is a sample file to demonstrate the WASM line processor.",
    "Each line will be processed individually with length prefixes.",
    "",
    "Lines can contain various content:",
    "- Short lines",
    "- Much longer lines with lots of content that spans across multiple words and contains various punctuation marks!",
    "- Lines with special characters: àáâãäåæçèéêë",
    "- Numbers: 123456789",
    "- Mixed content: Line 42 has 7 words and 123 numbers",
    "",
    "The processor handles:",
    "✓ Unix line endings (\\n)",
    "✓ Windows line endings (\\r\\n)", 
    "✓ Partial lines across chunk boundaries",
    "✓ Empty lines",
    "✓ UTF-8 content",
    "",
    "Performance is excellent for streaming data processing!"
  ];
  
  await Deno.writeTextFile("./test_input.txt", testContent.join('\n'));
  console.log("Created test file: test_input.txt");
}

async function main() {
  console.log("=== WASM Line Processor Integration Example ===\n");
  
  // Create a test file
  await createTestFile();
  
  // Process it with WASM
  await processFileWithWasm("./test_input.txt");
  
  // Clean up
  await Deno.remove("./test_input.txt");
  console.log("\nCleaned up test file");
}

if (import.meta.main) {
  main().catch(console.error);
}
