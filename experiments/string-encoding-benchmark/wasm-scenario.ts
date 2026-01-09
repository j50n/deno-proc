import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkWASMScenario() {
  console.log("WASM UTF-8 Data Parsing Performance");
  console.log("===================================\n");
  console.log("Scenario: UTF-8 bytes from WASM → parsed JavaScript data\n");

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
    
    // Simulate WASM output: UTF-8 encoded bytes for each format
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvBytes = encoder.encode(testData.join('\t'));
    const jsonBytes = encoder.encode(JSON.stringify(testData));

    console.log(`Byte sizes: StringRow=${stringRowBytes.length}, TSV=${tsvBytes.length}, JSON=${jsonBytes.length}\n`);

    // StringRow: UTF-8 bytes → StringRow object → access data
    const stringRowStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      const firstValue = row.get(0); // Extract first column value
    }
    const stringRowTime = performance.now() - stringRowStart;

    // TSV: UTF-8 bytes → decode → split → access data
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(tsvBytes);
      const columns = decoded.split('\t');
      const firstValue = columns[0]; // Extract first column value
    }
    const tsvTime = performance.now() - tsvStart;

    // JSON: UTF-8 bytes → decode → parse → access data
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(jsonBytes);
      const columns = JSON.parse(decoded);
      const firstValue = columns[0]; // Extract first column value
    }
    const jsonTime = performance.now() - jsonStart;

    // Results
    console.log("UTF-8 bytes → parsed data performance:");
    console.log(`StringRow: ${stringRowTime.toFixed(2)}ms (${(stringRowTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:       ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:      ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log();
    
    // Speed comparison
    console.log("Relative performance:");
    console.log(`StringRow vs TSV:  ${(stringRowTime/tsvTime).toFixed(2)}x ${stringRowTime < tsvTime ? '(faster)' : '(slower)'}`);
    console.log(`StringRow vs JSON: ${(stringRowTime/jsonTime).toFixed(2)}x ${stringRowTime < jsonTime ? '(faster)' : '(slower)'}`);
    console.log(`TSV vs JSON:       ${(tsvTime/jsonTime).toFixed(2)}x ${tsvTime < jsonTime ? '(faster)' : '(slower)'}`);
    
    console.log("\n" + "=".repeat(50) + "\n");
  }

  console.log("Summary: This measures the complete pipeline from WASM UTF-8 output");
  console.log("to accessing the first column value in JavaScript.");
}

benchmarkWASMScenario();
