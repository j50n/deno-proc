import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkWithWarmup() {
  console.log("UTF-8 Performance Comparison with 1000 Cycle Warmup");
  console.log("===================================================\n");

  const testCases = [
    { name: "Small rows", columns: 10, iterations: 1000 },
    { name: "Medium rows", columns: 50, iterations: 200 },
    { name: "Large rows", columns: 100, iterations: 100 }
  ];

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  for (const testCase of testCases) {
    console.log(`${testCase.name}: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    const testData = createTestData(testCase.columns);
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvBytes = encoder.encode(testData.join('\t'));
    const jsonBytes = encoder.encode(JSON.stringify(testData));

    console.log(`Data sizes - StringRow: ${stringRowBytes.length}b, TSV: ${tsvBytes.length}b, JSON: ${jsonBytes.length}b`);

    // WARMUP PHASE - 1000 cycles
    console.log("🔥 Warming up JIT compiler (1000 cycles)...");
    for (let i = 0; i < 1000; i++) {
      // StringRow warmup
      const row = new StringRow(stringRowBytes);
      row.get(0);
      
      // TSV warmup
      const decoded = decoder.decode(tsvBytes);
      const columns = decoded.split('\t');
      columns[0];
      
      // JSON warmup
      const jsonDecoded = decoder.decode(jsonBytes);
      const jsonColumns = JSON.parse(jsonDecoded);
      jsonColumns[0];
    }
    console.log("✅ Warmup complete\n");

    // StringRow test
    const stringRowStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      row.get(0);
    }
    const stringRowTime = performance.now() - stringRowStart;

    // TSV test
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(tsvBytes);
      const columns = decoded.split('\t');
      columns[0];
    }
    const tsvTime = performance.now() - tsvStart;

    // JSON test
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(jsonBytes);
      const columns = JSON.parse(decoded);
      columns[0];
    }
    const jsonTime = performance.now() - jsonStart;

    // Results
    console.log("Performance (UTF-8 bytes → parsed data):");
    console.log(`StringRow: ${stringRowTime.toFixed(2)}ms (${(stringRowTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:       ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:      ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log();
    
    console.log("Relative performance:");
    console.log(`StringRow vs TSV:  ${(stringRowTime/tsvTime).toFixed(2)}x ${stringRowTime < tsvTime ? '(faster)' : '(slower)'}`);
    console.log(`StringRow vs JSON: ${(stringRowTime/jsonTime).toFixed(2)}x ${stringRowTime < jsonTime ? '(faster)' : '(slower)'}`);
    console.log(`TSV vs JSON:       ${(tsvTime/jsonTime).toFixed(2)}x ${tsvTime < jsonTime ? '(faster)' : '(slower)'}`);
    
    // Throughput
    const stringRowThroughput = (stringRowBytes.length * testCase.iterations) / (stringRowTime * 1000);
    const tsvThroughput = (tsvBytes.length * testCase.iterations) / (tsvTime * 1000);
    const jsonThroughput = (jsonBytes.length * testCase.iterations) / (jsonTime * 1000);
    
    console.log();
    console.log("Throughput (KB/ms):");
    console.log(`StringRow: ${stringRowThroughput.toFixed(1)} KB/ms`);
    console.log(`TSV:       ${tsvThroughput.toFixed(1)} KB/ms`);
    console.log(`JSON:      ${jsonThroughput.toFixed(1)} KB/ms`);
    
    console.log("\n" + "=".repeat(60) + "\n");
  }
}

benchmarkWithWarmup();
