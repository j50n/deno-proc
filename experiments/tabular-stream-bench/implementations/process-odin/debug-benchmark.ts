#!/usr/bin/env -S deno run --allow-read --allow-run

/**
 * Debug what data we're actually processing
 */

import { StringRow } from "../../../../src/data-transform/string-row.ts";

const ODIN_CHILD_PROCESS = "./build/child_process";

async function debugBenchmark(csvFile: string) {
  console.log("=== Debug Data Processing ===");
  
  const startTime = performance.now();
  let rowCount = 0;
  let totalBytesRead = 0;
  let sampleRows: string[][] = [];
  
  // Start Odin child process
  const process = new Deno.Command(ODIN_CHILD_PROCESS, {
    stdin: "piped",
    stdout: "piped",
    stderr: "inherit"
  });
  
  const child = process.spawn();
  
  // Read CSV file and pipe to child process
  const file = await Deno.open(csvFile, { read: true });
  const writer = child.stdin.getWriter();
  const reader = child.stdout.getReader();
  
  // Pipe file to child process
  const pipePromise = file.readable.pipeTo(new WritableStream({
    write(chunk) {
      return writer.write(chunk);
    },
    close() {
      return writer.close();
    }
  }));
  
  // Read and process StringRow output with timing
  let buffer = new Uint8Array(0);
  let readStartTime = performance.now();
  
  try {
    // Read all data first
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      
      totalBytesRead += result.value.length;
      
      // Append to buffer
      const newBuffer = new Uint8Array(buffer.length + result.value.length);
      newBuffer.set(buffer);
      newBuffer.set(result.value, buffer.length);
      buffer = newBuffer;
      
      // Log progress every 10MB
      if (totalBytesRead % (10 * 1024 * 1024) === 0) {
        const elapsed = performance.now() - readStartTime;
        console.log(`Read ${totalBytesRead / (1024*1024)}MB in ${elapsed}ms`);
      }
    }
    
    const readEndTime = performance.now();
    console.log(`Total read time: ${readEndTime - readStartTime}ms`);
    console.log(`Total bytes read: ${totalBytesRead}`);
    
    // Parse buffer for length-prefixed StringRows
    const parseStartTime = performance.now();
    let offset = 0;
    while (offset + 4 <= buffer.length) {
      // Read length
      const length = new DataView(buffer.buffer, buffer.byteOffset + offset).getUint32(0, true);
      
      if (offset + 4 + length > buffer.length) {
        break; // Incomplete row data
      }
      
      // Extract StringRow data
      const rowData = buffer.slice(offset + 4, offset + 4 + length);
      
      // Parse StringRow
      const stringRow = StringRow.fromBytes(rowData);
      rowCount++;
      
      // Sample first few rows
      if (sampleRows.length < 5) {
        sampleRows.push(stringRow.toArray());
      }
      
      // Log progress every 100K rows
      if (rowCount % 100000 === 0) {
        const elapsed = performance.now() - parseStartTime;
        console.log(`Parsed ${rowCount} rows in ${elapsed}ms`);
      }
      
      offset += 4 + length;
    }
    
    const parseEndTime = performance.now();
    console.log(`Total parse time: ${parseEndTime - parseStartTime}ms`);
    
  } catch (error) {
    console.error("Error processing output:", error);
  }
  
  // Wait for child process
  const status = await child.status;
  
  const endTime = performance.now();
  const durationMs = endTime - startTime;
  
  console.log("\n=== Results ===");
  console.log(`Child process exit code: ${status.code}`);
  console.log(`Total rows processed: ${rowCount}`);
  console.log(`Total duration: ${durationMs}ms`);
  console.log(`Throughput: ${(rowCount / durationMs * 1000).toFixed(0)} rows/sec`);
  
  console.log("\n=== Sample Rows ===");
  sampleRows.forEach((row, i) => {
    console.log(`Row ${i}: [${row.join(", ")}]`);
  });
  
  console.log(`\n=== Data Validation ===`);
  console.log(`Expected columns per row: 10`);
  if (sampleRows.length > 0) {
    console.log(`Actual columns in samples: ${sampleRows.map(r => r.length).join(", ")}`);
  }
}

if (import.meta.main) {
  const csvFile = Deno.args[0];
  if (!csvFile) {
    console.error("Usage: debug-benchmark.ts <csv-file>");
    Deno.exit(1);
  }
  
  await debugBenchmark(csvFile);
}
