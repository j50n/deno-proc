#!/usr/bin/env -S deno run

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

// Serialize strings using length-prefixed scheme (like WASM approach)
function serializeStrings(strings: string[]): Uint8Array {
  // Calculate total size needed
  let totalSize = 4; // 4 bytes for count
  for (const str of strings) {
    totalSize += 4; // 4 bytes for length
    totalSize += new TextEncoder().encode(str).length; // UTF-8 bytes
  }
  
  // Create buffer and serialize
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  let pos = 0;
  
  // Write count
  view.setUint32(pos, strings.length, true); // little-endian
  pos += 4;
  
  // Write each string
  for (const str of strings) {
    const strBytes = new TextEncoder().encode(str);
    
    // Write length
    view.setUint32(pos, strBytes.length, true);
    pos += 4;
    
    // Write string data
    bytes.set(strBytes, pos);
    pos += strBytes.length;
  }
  
  return bytes;
}

// Deserialize strings from buffer
function deserializeStrings(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  const decoder = new TextDecoder('utf-8');
  let pos = 0;
  
  // Read count
  const count = view.getUint32(pos, true);
  pos += 4;
  
  const strings: string[] = [];
  
  // Read each string
  for (let i = 0; i < count; i++) {
    // Read length
    const length = view.getUint32(pos, true);
    pos += 4;
    
    // Read string data
    const strBytes = buffer.slice(pos, pos + length);
    const str = decoder.decode(strBytes);
    strings.push(str);
    pos += length;
  }
  
  return strings;
}

// Benchmark the serialization scheme
function benchmarkSerialization() {
  console.log("String Serialization Overhead Benchmark");
  console.log("=======================================");
  
  const testCases = [
    { columns: 100, iterations: 1000 },
    { columns: 1000, iterations: 100 },
    { columns: 10000, iterations: 10 },
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    // Generate test data
    const columns = generateColumnData(testCase.columns);
    
    // Calculate stats
    const totalChars = columns.reduce((sum, col) => sum + col.length, 0);
    const avgLength = totalChars / columns.length;
    
    console.log(`Average column length: ${avgLength.toFixed(1)} chars`);
    console.log(`Total characters: ${totalChars}`);
    
    // Benchmark serialization
    const serializeStart = performance.now();
    let serializedData: Uint8Array;
    for (let i = 0; i < testCase.iterations; i++) {
      serializedData = serializeStrings(columns);
    }
    const serializeEnd = performance.now();
    
    // Benchmark deserialization
    const deserializeStart = performance.now();
    let deserializedData: string[];
    for (let i = 0; i < testCase.iterations; i++) {
      deserializedData = deserializeStrings(serializedData!);
    }
    const deserializeEnd = performance.now();
    
    // Calculate overhead
    const serializeTime = serializeEnd - serializeStart;
    const deserializeTime = deserializeEnd - deserializeStart;
    const totalTime = serializeTime + deserializeTime;
    
    console.log(`Serialization time: ${serializeTime.toFixed(2)}ms`);
    console.log(`Deserialization time: ${deserializeTime.toFixed(2)}ms`);
    console.log(`Total round-trip time: ${totalTime.toFixed(2)}ms`);
    
    // Per-operation metrics
    const serializePerOp = serializeTime / testCase.iterations;
    const deserializePerOp = deserializeTime / testCase.iterations;
    const totalPerOp = totalTime / testCase.iterations;
    
    console.log(`Per operation - Serialize: ${serializePerOp.toFixed(3)}ms`);
    console.log(`Per operation - Deserialize: ${deserializePerOp.toFixed(3)}ms`);
    console.log(`Per operation - Total: ${totalPerOp.toFixed(3)}ms`);
    
    // Throughput
    const serializedSize = serializedData!.length;
    const throughput = (serializedSize * testCase.iterations) / totalTime / 1024; // KB/ms
    
    console.log(`Serialized size: ${serializedSize} bytes`);
    console.log(`Throughput: ${throughput.toFixed(1)} KB/ms`);
    
    // Verify correctness
    const roundTrip = deserializeStrings(serializeStrings(columns));
    const correct = JSON.stringify(columns) === JSON.stringify(roundTrip);
    console.log(`Round-trip correct: ${correct}`);
  }
}

benchmarkSerialization();
