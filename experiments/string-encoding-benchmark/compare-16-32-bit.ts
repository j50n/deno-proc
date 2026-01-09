import { StringRow } from "./string-row.ts";
import { StringRow16 } from "./string-row-16.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `col_${i}_data_${Math.random().toString(36).substring(2, 8)}`);
}

function benchmark16BitComparison() {
  console.log("32-bit vs 16-bit StringRow Performance");
  console.log("=====================================\n");

  const testCases = [
    { name: "Small rows", columns: 10, iterations: 1000 },
    { name: "Medium rows", columns: 50, iterations: 200 },
    { name: "Large rows", columns: 100, iterations: 100 }
  ];

  for (const testCase of testCases) {
    console.log(`${testCase.name}: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    const testData = createTestData(testCase.columns);
    
    // Check if data fits in 16-bit limits
    const totalChars = testData.join('').length;
    if (totalChars > 65535) {
      console.log(`⚠️  Data too large for 16-bit (${totalChars} chars), skipping...`);
      continue;
    }
    
    const stringRow32Bytes = StringRow.fromArray(testData).toBytes();
    const stringRow16Bytes = StringRow16.fromArray(testData).toBytes();

    console.log(`Data sizes: 32-bit=${stringRow32Bytes.length}b, 16-bit=${stringRow16Bytes.length}b (${((stringRow32Bytes.length - stringRow16Bytes.length) / stringRow32Bytes.length * 100).toFixed(1)}% smaller)`);

    // 32-bit StringRow - construction + toArray
    const sr32Start = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRow32Bytes);
      const values = row.toArray();
    }
    const sr32Time = performance.now() - sr32Start;

    // 16-bit StringRow - construction + toArray
    const sr16Start = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow16(stringRow16Bytes);
      const values = row.toArray();
    }
    const sr16Time = performance.now() - sr16Start;

    // 32-bit StringRow - getUnsafe access (first 5 columns)
    const sr32UnsafeStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRow32Bytes);
      const values = [
        row.getUnsafe(0),
        row.getUnsafe(1),
        row.getUnsafe(2),
        row.getUnsafe(3),
        row.getUnsafe(4)
      ];
    }
    const sr32UnsafeTime = performance.now() - sr32UnsafeStart;

    // 16-bit StringRow - getUnsafe access (first 5 columns)
    const sr16UnsafeStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow16(stringRow16Bytes);
      const values = [
        row.getUnsafe(0),
        row.getUnsafe(1),
        row.getUnsafe(2),
        row.getUnsafe(3),
        row.getUnsafe(4)
      ];
    }
    const sr16UnsafeTime = performance.now() - sr16UnsafeStart;

    console.log("\nFull access (toArray):");
    console.log(`32-bit: ${sr32Time.toFixed(2)}ms (${(sr32Time/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`16-bit: ${sr16Time.toFixed(2)}ms (${(sr16Time/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`16-bit is ${(sr32Time/sr16Time).toFixed(2)}x ${sr16Time < sr32Time ? 'faster' : 'slower'}`);

    console.log("\nPartial access (getUnsafe first 5):");
    console.log(`32-bit: ${sr32UnsafeTime.toFixed(2)}ms (${(sr32UnsafeTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`16-bit: ${sr16UnsafeTime.toFixed(2)}ms (${(sr16UnsafeTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`16-bit is ${(sr32UnsafeTime/sr16UnsafeTime).toFixed(2)}x ${sr16UnsafeTime < sr32UnsafeTime ? 'faster' : 'slower'}`);

    console.log("\n" + "=".repeat(60) + "\n");
  }

  console.log("16-bit Limitations:");
  console.log("• Max 65,535 columns");
  console.log("• Max 65,535 total characters in row");
  console.log("• Smaller memory footprint");
  console.log("• Potentially better cache performance");
}

benchmark16BitComparison();
