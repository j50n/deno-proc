#!/usr/bin/env -S deno run --allow-read --allow-run

/**
 * Test Odin child process with known data
 */

import { StringRow } from "../../../../src/data-transform/string-row.ts";

const ODIN_CHILD_PROCESS = "./build/child_process";

async function testOdinChildProcess() {
  console.log("=== Testing Odin Child Process ===");
  
  // Test data - simple CSV
  const testCsv = "a,b,c\n1,2,3\nhello,world,test";
  console.log("Input CSV:");
  console.log(testCsv);
  console.log();
  
  // Start Odin child process
  const process = new Deno.Command(ODIN_CHILD_PROCESS, {
    stdin: "piped",
    stdout: "piped",
    stderr: "piped"
  });
  
  const child = process.spawn();
  
  // Send test data
  const writer = child.stdin.getWriter();
  const reader = child.stdout.getReader();
  
  await writer.write(new TextEncoder().encode(testCsv));
  await writer.close();
  
  // Read all output
  const outputs: StringRow[] = [];
  let buffer = new Uint8Array(0);
  
  try {
    // Read all data first
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      
      // Append to buffer
      const newBuffer = new Uint8Array(buffer.length + result.value.length);
      newBuffer.set(buffer);
      newBuffer.set(result.value, buffer.length);
      buffer = newBuffer;
    }
    
    console.log(`Total bytes read: ${buffer.length}`);
    
    // Parse buffer for length-prefixed StringRows
    let offset = 0;
    while (offset + 4 <= buffer.length) {
      // Read length
      const length = new DataView(buffer.buffer, buffer.byteOffset + offset).getUint32(0, true);
      console.log(`Reading StringRow of length: ${length} at offset ${offset}`);
      
      if (offset + 4 + length > buffer.length) {
        console.log("Incomplete row data");
        break;
      }
      
      // Extract StringRow data
      const rowData = buffer.slice(offset + 4, offset + 4 + length);
      
      // Parse StringRow
      const stringRow = StringRow.fromBytes(rowData);
      outputs.push(stringRow);
      
      console.log(`Row ${outputs.length}: ${stringRow.columnCount} columns`);
      for (let i = 0; i < stringRow.columnCount; i++) {
        console.log(`  [${i}]: "${stringRow.get(i)}"`);
      }
      
      offset += 4 + length;
    }
  } catch (error) {
    console.error("Error reading output:", error);
  }
  
  // Get stderr
  const stderrReader = child.stderr.getReader();
  const stderrResult = await stderrReader.read();
  if (!stderrResult.done && stderrResult.value.length > 0) {
    console.log("Stderr:", new TextDecoder().decode(stderrResult.value));
  }
  
  const status = await child.status;
  console.log(`Child process exit code: ${status.code}`);
  console.log(`Total rows processed: ${outputs.length}`);
  
  // Verify expected output
  const expectedRows = [
    ["a", "b", "c"],
    ["1", "2", "3"], 
    ["hello", "world", "test"]
  ];
  
  console.log("\n=== Verification ===");
  if (outputs.length !== expectedRows.length) {
    console.log(`❌ Row count mismatch: got ${outputs.length}, expected ${expectedRows.length}`);
    return false;
  }
  
  for (let i = 0; i < expectedRows.length; i++) {
    const actual = outputs[i].toArray();
    const expected = expectedRows[i];
    
    if (actual.length !== expected.length) {
      console.log(`❌ Row ${i} column count mismatch: got ${actual.length}, expected ${expected.length}`);
      return false;
    }
    
    for (let j = 0; j < expected.length; j++) {
      if (actual[j] !== expected[j]) {
        console.log(`❌ Row ${i} col ${j} mismatch: got "${actual[j]}", expected "${expected[j]}"`);
        return false;
      }
    }
    
    console.log(`✅ Row ${i} matches: [${actual.join(", ")}]`);
  }
  
  console.log("✅ All tests passed!");
  return true;
}

if (import.meta.main) {
  const success = await testOdinChildProcess();
  Deno.exit(success ? 0 : 1);
}
