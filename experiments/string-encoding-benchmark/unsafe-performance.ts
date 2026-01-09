import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkUnsafeAccess() {
  console.log("getUnsafe vs get Performance Comparison");
  console.log("=======================================\n");
  console.log("Scenario: 100 columns, accessing first 5 columns\n");

  const iterations = 1000;
  const testData = createTestData(100);
  const stringRowBytes = StringRow.fromArray(testData).toBytes();

  // Test with bounds checking (get method)
  const safeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowBytes);
    const values = [
      row.get(0),
      row.get(1), 
      row.get(2),
      row.get(3),
      row.get(4)
    ];
  }
  const safeTime = performance.now() - safeStart;

  // Test without bounds checking (getUnsafe method)
  const unsafeStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowBytes);
    const values = [
      row.getUnsafe(0),
      row.getUnsafe(1), 
      row.getUnsafe(2),
      row.getUnsafe(3),
      row.getUnsafe(4)
    ];
  }
  const unsafeTime = performance.now() - unsafeStart;

  console.log("Performance comparison:");
  console.log(`get() (safe):        ${safeTime.toFixed(2)}ms (${(safeTime/iterations).toFixed(3)}ms/op)`);
  console.log(`getUnsafe() (fast):  ${unsafeTime.toFixed(2)}ms (${(unsafeTime/iterations).toFixed(3)}ms/op)`);
  console.log();
  
  console.log("Performance improvement:");
  console.log(`getUnsafe is ${(safeTime/unsafeTime).toFixed(2)}x faster than get()`);
  console.log(`Overhead eliminated: ${(safeTime - unsafeTime).toFixed(2)}ms (${((safeTime/unsafeTime - 1) * 100).toFixed(1)}% improvement)`);
  
  // Compare with text formats using getUnsafe
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const tsvBytes = encoder.encode(testData.join('\t'));
  const jsonBytes = encoder.encode(JSON.stringify(testData));

  const tsvStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(tsvBytes);
    const columns = decoded.split('\t');
    const values = [columns[0], columns[1], columns[2], columns[3], columns[4]];
  }
  const tsvTime = performance.now() - tsvStart;

  const jsonStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(jsonBytes);
    const columns = JSON.parse(decoded);
    const values = [columns[0], columns[1], columns[2], columns[3], columns[4]];
  }
  const jsonTime = performance.now() - jsonStart;

  console.log("\nComparison with text formats (using getUnsafe):");
  console.log(`StringRow getUnsafe: ${unsafeTime.toFixed(2)}ms`);
  console.log(`TSV:                 ${tsvTime.toFixed(2)}ms`);
  console.log(`JSON:                ${jsonTime.toFixed(2)}ms`);
  console.log();
  console.log(`StringRow vs TSV:  ${(unsafeTime/tsvTime).toFixed(2)}x ${unsafeTime < tsvTime ? '(faster)' : '(slower)'}`);
  console.log(`StringRow vs JSON: ${(unsafeTime/jsonTime).toFixed(2)}x ${unsafeTime < jsonTime ? '(faster)' : '(slower)'}`);
  
  console.log("\n🚀 getUnsafe() provides maximum performance for trusted column access!");
}

benchmarkUnsafeAccess();
