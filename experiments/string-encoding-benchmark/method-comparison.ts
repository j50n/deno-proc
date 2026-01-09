#!/usr/bin/env -S deno run

import { stringify, parse } from "jsr:@std/csv";

// Generate test data: 100 columns of text, 1-20 chars each
function generateColumnData(numColumns: number): string[] {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const columns: string[] = [];
  
  for (let i = 0; i < numColumns; i++) {
    const length = Math.floor(Math.random() * 20) + 1; // 1-20 chars
    let column = "";
    for (let j = 0; j < length; j++) {
      column += chars[Math.floor(Math.random() * chars.length)];
    }
    columns.push(column);
  }
  
  return columns;
}

// Single-decode approach with character indices
function serializeStringsSingleDecode(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  
  // Join all strings with no separator
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  // Calculate character positions in the joined string
  const indices: number[] = [strings.length]; // First: array size
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);           // Start position
    indices.push(str.length);        // Character length
    charPos += str.length;
  }
  
  // Create buffer: indices array + text data
  const indicesBytes = indices.length * 4; // 4 bytes per uint32
  const totalSize = indicesBytes + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  // Write indices
  for (let i = 0; i < indices.length; i++) {
    view.setUint32(i * 4, indices[i], true);
  }
  
  // Write text data
  bytes.set(textBytes, indicesBytes);
  
  return bytes;
}

function deserializeStringsSingleDecode(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  
  // Read array size
  const count = view.getUint32(0, true);
  
  // Read all indices
  const indicesEnd = (1 + count * 2) * 4;
  
  // Decode entire text at once
  const textBytes = buffer.subarray(indicesEnd);
  const allText = new TextDecoder('utf-8').decode(textBytes);
  
  // Extract strings using character positions
  const strings = new Array<string>(count);
  
  for (let i = 0; i < count; i++) {
    const startPos = view.getUint32((1 + i * 2) * 4, true);
    const length = view.getUint32((1 + i * 2 + 1) * 4, true);
    strings[i] = allText.substring(startPos, startPos + length);
  }
  
  return strings;
}

// TSV approach
function serializeTSV(strings: string[]): Uint8Array {
  const tsvString = strings.join('\t');
  return new TextEncoder().encode(tsvString);
}

function deserializeTSV(buffer: Uint8Array): string[] {
  const tsvString = new TextDecoder('utf-8').decode(buffer);
  return tsvString.split('\t');
}

// JSON approach
function serializeJSON(strings: string[]): Uint8Array {
  const jsonString = JSON.stringify(strings);
  return new TextEncoder().encode(jsonString);
}

function deserializeJSON(buffer: Uint8Array): string[] {
  const jsonString = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(jsonString);
}

// Deno CSV approach
function serializeCSV(strings: string[]): Uint8Array {
  const csvString = stringify([strings]);
  return new TextEncoder().encode(csvString);
}

function deserializeCSV(buffer: Uint8Array): string[] {
  const csvString = new TextDecoder('utf-8').decode(buffer);
  const parsed = parse(csvString);
  return parsed[0] as string[];
}

// Benchmark all approaches
function benchmarkComparison() {
  console.log("String Serialization Method Comparison (with Deno CSV)");
  console.log("=====================================================");
  
  const testCases = [
    { columns: 100, iterations: 1000 },
    { columns: 1000, iterations: 100 },
    { columns: 10000, iterations: 10 },
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    // Generate test data
    const columns = generateColumnData(testCase.columns);
    const totalChars = columns.reduce((sum, col) => sum + col.length, 0);
    console.log(`Total characters: ${totalChars}`);
    
    // Test each approach
    const approaches = [
      { name: "Single-Decode", serialize: serializeStringsSingleDecode, deserialize: deserializeStringsSingleDecode },
      { name: "TSV (Tab Split)", serialize: serializeTSV, deserialize: deserializeTSV },
      { name: "JSON", serialize: serializeJSON, deserialize: deserializeJSON },
      { name: "Deno CSV", serialize: serializeCSV, deserialize: deserializeCSV },
    ];
    
    for (const approach of approaches) {
      // WARMUP ROUNDS - 100 iterations to fully stabilize JIT
      for (let w = 0; w < 100; w++) {
        const warmupData = approach.serialize(columns);
        approach.deserialize(warmupData);
      }
      
      // Benchmark serialization
      const serializeStart = performance.now();
      let serializedData: Uint8Array;
      for (let i = 0; i < testCase.iterations; i++) {
        serializedData = approach.serialize(columns);
      }
      const serializeEnd = performance.now();
      
      // Benchmark deserialization
      const deserializeStart = performance.now();
      let deserializedData: string[];
      for (let i = 0; i < testCase.iterations; i++) {
        deserializedData = approach.deserialize(serializedData!);
      }
      const deserializeEnd = performance.now();
      
      const serializeTime = serializeEnd - serializeStart;
      const deserializeTime = deserializeEnd - deserializeStart;
      const totalTime = serializeTime + deserializeTime;
      
      console.log(`\n${approach.name}:`);
      console.log(`  Serialize: ${serializeTime.toFixed(2)}ms (${(serializeTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Deserialize: ${deserializeTime.toFixed(2)}ms (${(deserializeTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Total: ${totalTime.toFixed(2)}ms (${(totalTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Size: ${serializedData!.length} bytes`);
      console.log(`  Throughput: ${((serializedData!.length * testCase.iterations) / totalTime / 1024).toFixed(1)} KB/ms`);
      
      // Verify correctness
      const roundTrip = approach.deserialize(approach.serialize(columns));
      const correct = JSON.stringify(columns) === JSON.stringify(roundTrip);
      console.log(`  Correct: ${correct}`);
    }
  }
}

benchmarkComparison();
