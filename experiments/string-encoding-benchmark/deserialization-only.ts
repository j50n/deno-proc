import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkDeserialization() {
  console.log("Deserialization Performance Comparison");
  console.log("=====================================\n");

  const testCases = [
    { name: "Small rows", columns: 10, iterations: 1000 },
    { name: "Medium rows", columns: 50, iterations: 200 },
    { name: "Large rows", columns: 100, iterations: 100 }
  ];

  for (const testCase of testCases) {
    console.log(`${testCase.name}: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    const testData = createTestData(testCase.columns);
    const totalChars = testData.join('').length;
    console.log(`Total characters: ${totalChars}\n`);

    // Pre-serialize all formats
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvData = testData.join('\t');
    const jsonData = JSON.stringify(testData);
    const csvData = testData.map(col => `"${col.replace(/"/g, '""')}"`).join(',');

    // StringRow deserialization
    const stringRowStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      // Access first column to ensure full deserialization
      row.get(0);
    }
    const stringRowTime = performance.now() - stringRowStart;

    // TSV deserialization
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = tsvData.split('\t');
      // Access first element
      parsed[0];
    }
    const tsvTime = performance.now() - tsvStart;

    // JSON deserialization
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = JSON.parse(jsonData);
      // Access first element
      parsed[0];
    }
    const jsonTime = performance.now() - jsonStart;

    // CSV deserialization (simple split - not handling quotes properly for speed)
    const csvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = csvData.split(',').map(col => col.slice(1, -1)); // Remove quotes
      // Access first element
      parsed[0];
    }
    const csvTime = performance.now() - csvStart;

    // Results
    console.log(`StringRow: ${stringRowTime.toFixed(2)}ms (${(stringRowTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:       ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:      ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`CSV:       ${csvTime.toFixed(2)}ms (${(csvTime/testCase.iterations).toFixed(3)}ms/op)`);
    
    // Ratios
    console.log(`\nStringRow vs TSV:  ${(stringRowTime/tsvTime).toFixed(2)}x`);
    console.log(`StringRow vs JSON: ${(stringRowTime/jsonTime).toFixed(2)}x`);
    console.log(`StringRow vs CSV:  ${(stringRowTime/csvTime).toFixed(2)}x`);
    console.log("\n" + "=".repeat(50) + "\n");
  }
}

benchmarkDeserialization();
