import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkBoundsCheckOverhead() {
  console.log("Bounds Check Overhead Analysis");
  console.log("==============================\n");

  const iterations = 1000;
  const testData = createTestData(100);
  const stringRowBytes = StringRow.fromArray(testData).toBytes();

  // Test with bounds checking (current get method)
  const boundsCheckStart = performance.now();
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
  const boundsCheckTime = performance.now() - boundsCheckStart;

  // Test without bounds checking (direct getUnchecked access)
  // We'll need to access the private method for this test
  const noBoundsStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowBytes);
    // Access private getUnchecked method via any cast
    const rowAny = row as any;
    const values = [
      rowAny.getUnchecked(0),
      rowAny.getUnchecked(1), 
      rowAny.getUnchecked(2),
      rowAny.getUnchecked(3),
      rowAny.getUnchecked(4)
    ];
  }
  const noBoundsTime = performance.now() - noBoundsStart;

  // Test just the bounds check overhead in isolation
  const boundsOnlyStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowBytes);
    const columnCount = row.columnCount;
    // Simulate bounds checks without actual data access
    for (let col = 0; col < 5; col++) {
      if (col < 0 || col >= columnCount) {
        throw new Error(`Column index ${col} out of bounds`);
      }
    }
  }
  const boundsOnlyTime = performance.now() - boundsOnlyStart;

  console.log("Performance comparison (1000 iterations, accessing 5 columns):");
  console.log(`With bounds checking:    ${boundsCheckTime.toFixed(2)}ms`);
  console.log(`Without bounds checking: ${noBoundsTime.toFixed(2)}ms`);
  console.log(`Bounds check overhead:   ${(boundsCheckTime - noBoundsTime).toFixed(2)}ms`);
  console.log(`Bounds check only:       ${boundsOnlyTime.toFixed(2)}ms`);
  console.log();
  
  console.log("Overhead analysis:");
  console.log(`Bounds checking adds:    ${((boundsCheckTime / noBoundsTime - 1) * 100).toFixed(1)}% overhead`);
  console.log(`Per operation overhead:  ${((boundsCheckTime - noBoundsTime) / iterations).toFixed(4)}ms`);
  console.log(`Per column check:        ${((boundsCheckTime - noBoundsTime) / (iterations * 5)).toFixed(6)}ms`);
  
  console.log("\nConclusion:");
  if ((boundsCheckTime / noBoundsTime - 1) * 100 < 5) {
    console.log("✅ Bounds checking overhead is minimal (<5%)");
  } else if ((boundsCheckTime / noBoundsTime - 1) * 100 < 15) {
    console.log("⚠️  Bounds checking has moderate overhead (5-15%)");
  } else {
    console.log("❌ Bounds checking has significant overhead (>15%)");
  }
  
  console.log("\nNote: Bounds checking provides safety and prevents crashes.");
  console.log("For maximum performance in trusted scenarios, consider unsafe access methods.");
}

benchmarkBoundsCheckOverhead();
