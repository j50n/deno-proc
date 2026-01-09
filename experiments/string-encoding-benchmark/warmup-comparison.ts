import { StringRow } from "./string-row.ts";
import { StringRow16 } from "./string-row-16.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `col_${i}_data_${Math.random().toString(36).substring(2, 8)}`);
}

function benchmarkWithWarmup() {
  console.log("16-bit vs 32-bit Performance with JIT Warmup");
  console.log("=============================================\n");

  const testData = createTestData(50);
  const iterations = 1000;
  const warmupIterations = 500;
  
  const stringRow32Bytes = StringRow.fromArray(testData).toBytes();
  const stringRow16Bytes = StringRow16.fromArray(testData).toBytes();

  console.log(`Data sizes: 32-bit=${stringRow32Bytes.length}b, 16-bit=${stringRow16Bytes.length}b`);
  console.log(`Warmup iterations: ${warmupIterations}, Test iterations: ${iterations}\n`);

  // WARMUP PHASE
  console.log("🔥 Warming up JIT compiler...");
  
  // Warmup 32-bit construction
  for (let i = 0; i < warmupIterations; i++) {
    new StringRow(stringRow32Bytes);
  }
  
  // Warmup 16-bit construction  
  for (let i = 0; i < warmupIterations; i++) {
    new StringRow16(stringRow16Bytes);
  }

  // Warmup array access
  const warmupRow32 = new StringRow(stringRow32Bytes);
  const warmupRow16 = new StringRow16(stringRow16Bytes);
  
  for (let i = 0; i < warmupIterations; i++) {
    warmupRow32.toArray();
    warmupRow16.toArray();
  }

  console.log("✅ Warmup complete\n");

  // TEST PHASE - Construction
  console.log("📊 Testing construction performance:");
  
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

  console.log(`32-bit construction: ${construct32Time.toFixed(2)}ms (${(construct32Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit construction: ${construct16Time.toFixed(2)}ms (${(construct16Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit is ${(construct32Time/construct16Time).toFixed(2)}x ${construct16Time < construct32Time ? 'faster' : 'slower'}\n`);

  // TEST PHASE - Array access
  console.log("📊 Testing array access performance:");
  
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

  console.log(`32-bit array access: ${access32Time.toFixed(2)}ms (${(access32Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit array access: ${access16Time.toFixed(2)}ms (${(access16Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit is ${(access32Time/access16Time).toFixed(2)}x ${access16Time < access32Time ? 'faster' : 'slower'}\n`);

  // TEST PHASE - Combined (construction + access)
  console.log("📊 Testing combined performance (construction + toArray):");
  
  const combined32Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRow32Bytes);
    row.toArray();
  }
  const combined32Time = performance.now() - combined32Start;

  const combined16Start = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow16(stringRow16Bytes);
    row.toArray();
  }
  const combined16Time = performance.now() - combined16Start;

  console.log(`32-bit combined: ${combined32Time.toFixed(2)}ms (${(combined32Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit combined: ${combined16Time.toFixed(2)}ms (${(combined16Time/iterations).toFixed(4)}ms/op)`);
  console.log(`16-bit is ${(combined32Time/combined16Time).toFixed(2)}x ${combined16Time < combined32Time ? 'faster' : 'slower'}\n`);

  // Analysis
  console.log("🔍 Analysis after JIT warmup:");
  const constructionSpeedup = construct32Time / construct16Time;
  const accessSpeedup = access32Time / access16Time;
  const combinedSpeedup = combined32Time / combined16Time;
  
  if (constructionSpeedup > 2.0) {
    console.log(`⚠️  Construction still shows ${constructionSpeedup.toFixed(2)}x speedup - may indicate V8 optimization differences`);
  } else {
    console.log(`✅ Construction speedup normalized to ${constructionSpeedup.toFixed(2)}x after warmup`);
  }
  
  if (accessSpeedup > 1.5) {
    console.log(`⚠️  Array access shows ${accessSpeedup.toFixed(2)}x speedup - unexpected for 64-bit machine`);
  } else {
    console.log(`✅ Array access speedup is reasonable at ${accessSpeedup.toFixed(2)}x`);
  }
  
  console.log(`📈 Overall combined performance: ${combinedSpeedup.toFixed(2)}x improvement`);
}

benchmarkWithWarmup();
