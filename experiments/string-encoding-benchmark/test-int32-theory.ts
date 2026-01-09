import { StringRow } from "./string-row.ts";
import { StringRow16 } from "./string-row-16.ts";
import { StringRowInt32 } from "./string-row-int32.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `col_${i}_data_${Math.random().toString(36).substring(2, 8)}`);
}

function benchmarkAllTypedArrays() {
  console.log("Typed Array Performance Comparison");
  console.log("==================================\n");

  const testData = createTestData(50);
  const iterations = 1000;
  const warmupIterations = 500;
  
  const stringRowUint32Bytes = StringRow.fromArray(testData).toBytes();
  const stringRowInt32Bytes = StringRowInt32.fromArray(testData).toBytes();
  const stringRow16Bytes = StringRow16.fromArray(testData).toBytes();

  console.log(`Data sizes:`);
  console.log(`  Uint32Array: ${stringRowUint32Bytes.length}b`);
  console.log(`  Int32Array:  ${stringRowInt32Bytes.length}b`);
  console.log(`  Uint16Array: ${stringRow16Bytes.length}b`);
  console.log();

  // WARMUP
  console.log("🔥 Warming up JIT...");
  for (let i = 0; i < warmupIterations; i++) {
    new StringRow(stringRowUint32Bytes).toArray();
    new StringRowInt32(stringRowInt32Bytes).toArray();
    new StringRow16(stringRow16Bytes).toArray();
  }
  console.log("✅ Warmup complete\n");

  // TEST: Construction + toArray
  console.log("📊 Combined Performance (construction + toArray):");
  
  const uint32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowUint32Bytes);
    row.toArray();
  }
  const uint32Time = performance.now() - uint32Start;

  const int32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRowInt32(stringRowInt32Bytes);
    row.toArray();
  }
  const int32Time = performance.now() - int32Start;

  const uint16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow16(stringRow16Bytes);
    row.toArray();
  }
  const uint16Time = performance.now() - uint16Start;

  console.log(`Uint32Array: ${uint32Time.toFixed(2)}ms (${(uint32Time/iterations).toFixed(4)}ms/op)`);
  console.log(`Int32Array:  ${int32Time.toFixed(2)}ms (${(int32Time/iterations).toFixed(4)}ms/op)`);
  console.log(`Uint16Array: ${uint16Time.toFixed(2)}ms (${(uint16Time/iterations).toFixed(4)}ms/op)`);
  console.log();

  // Performance ratios
  console.log("🏆 Performance Rankings:");
  const results = [
    { name: "Uint32Array", time: uint32Time },
    { name: "Int32Array", time: int32Time },
    { name: "Uint16Array", time: uint16Time }
  ].sort((a, b) => a.time - b.time);

  results.forEach((result, index) => {
    const speedup = results[0].time === result.time ? 1 : result.time / results[0].time;
    console.log(`${index + 1}. ${result.name}: ${result.time.toFixed(2)}ms (${speedup.toFixed(2)}x ${speedup === 1 ? 'fastest' : 'slower'})`);
  });

  console.log();
  console.log("🔍 SMI Theory Validation:");
  console.log(`Int32Array vs Uint32Array: ${(uint32Time/int32Time).toFixed(2)}x ${int32Time < uint32Time ? 'faster' : 'slower'}`);
  
  if (int32Time < uint32Time) {
    console.log("✅ Theory confirmed: Int32Array is faster due to SMI optimization!");
  } else {
    console.log("❌ Theory not confirmed: Int32Array is not faster than Uint32Array");
  }
}

benchmarkAllTypedArrays();
