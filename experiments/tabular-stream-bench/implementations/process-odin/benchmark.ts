#!/usr/bin/env -S deno run --allow-read --allow-run

/**
 * Benchmark process-odin implementation
 */

import { StringRow } from "../../../../src/data-transform/string-row.ts";

const ODIN_CHILD_PROCESS = "./build/child_process";

async function benchmark(csvFile: string) {
  const startTime = performance.now();
  let rowCount = 0;
  let columnMismatches = 0;
  
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
  
  // Pipe file to child process (this will close the file when done)
  const pipePromise = file.readable.pipeTo(new WritableStream({
    write(chunk) {
      return writer.write(chunk);
    },
    close() {
      return writer.close();
    }
  }));
  
  // Read and process StringRow output
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  
  try {
    // Collect all chunks efficiently
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      
      chunks.push(result.value);
      totalBytes += result.value.length;
    }
    
    // Concatenate once at the end
    const buffer = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      buffer.set(chunk, offset);
      offset += chunk.length;
    }
    
    // Parse buffer for length-prefixed StringRows
    offset = 0;
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
      
      // Validate column count (assuming 10 columns like other benchmarks)
      if (stringRow.columnCount !== 10) {
        columnMismatches++;
      }
      
      offset += 4 + length;
    }
  } catch (error) {
    console.error("Error processing output:", error);
  }
  
  // Wait for child process
  const status = await child.status;
  
  const endTime = performance.now();
  const durationMs = endTime - startTime;
  
  if (!status.success) {
    console.error("Child process failed with code:", status.code);
    return;
  }
  
  // Calculate throughput
  const throughputRowsPerSec = (rowCount / durationMs) * 1000;
  const fileSizeBytes = (await Deno.stat(csvFile)).size;
  const throughputMBPerSec = (fileSizeBytes / (1024 * 1024)) / (durationMs / 1000);
  
  // Output results in same format as other benchmarks
  const result = {
    implementation: "process-odin",
    format: "csv",
    columns: 10,
    rowsProcessed: rowCount,
    columnMismatches,
    durationMs,
    memoryPeakMB: 0, // Not measured for child process
    throughputRowsPerSec,
    throughputMBPerSec
  };
  
  console.log(JSON.stringify(result));
}

if (import.meta.main) {
  const csvFile = Deno.args[0];
  if (!csvFile) {
    console.error("Usage: benchmark.ts <csv-file>");
    Deno.exit(1);
  }
  
  await benchmark(csvFile);
}
