import { StringRow } from "./string-row.ts";
import { StringRow16 } from "./string-row-16.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `col_${i}_data_${Math.random().toString(36).substring(2, 8)}`);
}

function investigateSpeedup() {
  console.log("Investigating 16-bit vs 32-bit Speedup");
  console.log("======================================\n");

  const testData = createTestData(50);
  const iterations = 1000;
  
  const stringRow32Bytes = StringRow.fromArray(testData).toBytes();
  const stringRow16Bytes = StringRow16.fromArray(testData).toBytes();

  console.log(`Data sizes: 32-bit=${stringRow32Bytes.length}b, 16-bit=${stringRow16Bytes.length}b`);
  console.log(`Position array sizes: 32-bit=${51 * 4}b, 16-bit=${51 * 2}b\n`);

  // Test 1: Just construction (no data access)
  console.log("1. Construction only (no data access):");
  
  const construct32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    new StringRow(stringRow32Bytes);
  }
  const construct32Time = performance.now() - construct32Start;

  const construct16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    new StringRow16(stringRow16Bytes);
  }
  const construct16Time = performance.now() - construct16Start;

  console.log(`32-bit construction: ${construct32Time.toFixed(2)}ms`);
  console.log(`16-bit construction: ${construct16Time.toFixed(2)}ms`);
  console.log(`16-bit is ${(construct32Time/construct16Time).toFixed(2)}x faster\n`);

  // Test 2: Just array access (no construction)
  console.log("2. Array access only (pre-constructed objects):");
  
  const row32 = new StringRow(stringRow32Bytes);
  const row16 = new StringRow16(stringRow16Bytes);

  const access32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    row32.toArray();
  }
  const access32Time = performance.now() - access32Start;

  const access16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    row16.toArray();
  }
  const access16Time = performance.now() - access16Start;

  console.log(`32-bit array access: ${access32Time.toFixed(2)}ms`);
  console.log(`16-bit array access: ${access16Time.toFixed(2)}ms`);
  console.log(`16-bit is ${(access32Time/access16Time).toFixed(2)}x faster\n`);

  // Test 3: Memory allocation patterns
  console.log("3. Memory allocation analysis:");
  
  const allocTest32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const buffer = new ArrayBuffer(stringRow32Bytes.length);
    const uint32View = new Uint32Array(buffer, 0, buffer.byteLength >>> 2);
  }
  const allocTest32Time = performance.now() - allocTest32Start;

  const allocTest16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const buffer = new ArrayBuffer(stringRow16Bytes.length);
    const uint16View = new Uint16Array(buffer, 0, buffer.byteLength >>> 1);
  }
  const allocTest16Time = performance.now() - allocTest16Start;

  console.log(`32-bit allocation: ${allocTest32Time.toFixed(2)}ms`);
  console.log(`16-bit allocation: ${allocTest16Time.toFixed(2)}ms`);
  console.log(`16-bit is ${(allocTest32Time/allocTest16Time).toFixed(2)}x faster\n`);

  // Test 4: Raw array access patterns
  console.log("4. Raw typed array access:");
  
  const raw32Array = new Uint32Array(stringRow32Bytes.buffer, 0, stringRow32Bytes.length >>> 2);
  const raw16Array = new Uint16Array(stringRow16Bytes.buffer, 0, stringRow16Bytes.length >>> 1);

  const rawAccess32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < 10; j++) {
      const value = raw32Array[j];
    }
  }
  const rawAccess32Time = performance.now() - rawAccess32Start;

  const rawAccess16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < 10; j++) {
      const value = raw16Array[j];
    }
  }
  const rawAccess16Time = performance.now() - rawAccess16Start;

  console.log(`32-bit raw access: ${rawAccess32Time.toFixed(2)}ms`);
  console.log(`16-bit raw access: ${rawAccess16Time.toFixed(2)}ms`);
  console.log(`16-bit is ${(rawAccess32Time/rawAccess16Time).toFixed(2)}x faster\n`);

  console.log("Analysis:");
  console.log("The speedup might be coming from:");
  console.log("• Better cache utilization (smaller data structures)");
  console.log("• Faster typed array creation/access");
  console.log("• Memory bandwidth savings");
  console.log("• V8 optimization differences between Uint16Array and Uint32Array");
}

investigateSpeedup();
