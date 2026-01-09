import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkFullAccess() {
  console.log("Full Row Access Performance");
  console.log("===========================\n");

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

    // StringRow - full access with get() (bounds checking)
    const stringRowSafeStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      const values: string[] = [];
      for (let col = 0; col < testCase.columns; col++) {
        values.push(row.get(col));
      }
    }
    const stringRowSafeTime = performance.now() - stringRowSafeStart;

    // StringRow - full access with getUnsafe() (no bounds checking)
    const stringRowUnsafeStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      const values: string[] = [];
      for (let col = 0; col < testCase.columns; col++) {
        values.push(row.getUnsafe(col));
      }
    }
    const stringRowUnsafeTime = performance.now() - stringRowUnsafeStart;

    // StringRow - using toArray() method
    const stringRowArrayStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      const values = row.toArray();
    }
    const stringRowArrayTime = performance.now() - stringRowArrayStart;

    // TSV - full access
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(tsvBytes);
      const values = decoded.split('\t');
    }
    const tsvTime = performance.now() - tsvStart;

    // JSON - full access
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(jsonBytes);
      const values = JSON.parse(decoded);
    }
    const jsonTime = performance.now() - jsonStart;

    console.log(`Data sizes: StringRow=${stringRowBytes.length}b, TSV=${tsvBytes.length}b, JSON=${jsonBytes.length}b\n`);

    console.log("Performance (full row access):");
    console.log(`StringRow get():     ${stringRowSafeTime.toFixed(2)}ms (${(stringRowSafeTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`StringRow getUnsafe(): ${stringRowUnsafeTime.toFixed(2)}ms (${(stringRowUnsafeTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`StringRow toArray(): ${stringRowArrayTime.toFixed(2)}ms (${(stringRowArrayTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:                 ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:                ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log();

    console.log("Best StringRow method vs text formats:");
    const bestStringRowTime = Math.min(stringRowSafeTime, stringRowUnsafeTime, stringRowArrayTime);
    const bestMethod = bestStringRowTime === stringRowSafeTime ? "get()" : 
                      bestStringRowTime === stringRowUnsafeTime ? "getUnsafe()" : "toArray()";
    
    console.log(`Best StringRow (${bestMethod}): ${bestStringRowTime.toFixed(2)}ms`);
    console.log(`vs TSV:  ${(bestStringRowTime/tsvTime).toFixed(2)}x ${bestStringRowTime < tsvTime ? '(faster)' : '(slower)'}`);
    console.log(`vs JSON: ${(bestStringRowTime/jsonTime).toFixed(2)}x ${bestStringRowTime < jsonTime ? '(faster)' : '(slower)'}`);

    console.log("\n" + "=".repeat(60) + "\n");
  }
}

benchmarkFullAccess();
