import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkWithUTF8() {
  console.log("UTF-8 Encoding/Decoding Performance Comparison");
  console.log("==============================================\n");

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
    
    // Pre-encode all formats to UTF-8 bytes
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvString = testData.join('\t');
    const tsvBytes = encoder.encode(tsvString);
    const jsonString = JSON.stringify(testData);
    const jsonBytes = encoder.encode(jsonString);

    console.log(`StringRow bytes: ${stringRowBytes.length}`);
    console.log(`TSV bytes: ${tsvBytes.length}`);
    console.log(`JSON bytes: ${jsonBytes.length}\n`);

    // StringRow - from UTF-8 bytes
    const stringRowStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      row.get(0); // Access first column
    }
    const stringRowTime = performance.now() - stringRowStart;

    // TSV - decode UTF-8 then parse
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(tsvBytes);
      const parsed = decoded.split('\t');
      parsed[0]; // Access first element
    }
    const tsvTime = performance.now() - tsvStart;

    // TSV - parse from string (no UTF-8 decode)
    const tsvStringStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = tsvString.split('\t');
      parsed[0]; // Access first element
    }
    const tsvStringTime = performance.now() - tsvStringStart;

    // JSON - decode UTF-8 then parse
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(jsonBytes);
      const parsed = JSON.parse(decoded);
      parsed[0]; // Access first element
    }
    const jsonTime = performance.now() - jsonStart;

    // JSON - parse from string (no UTF-8 decode)
    const jsonStringStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = JSON.parse(jsonString);
      parsed[0]; // Access first element
    }
    const jsonStringTime = performance.now() - jsonStringStart;

    // Results
    console.log(`StringRow (from UTF-8 bytes): ${stringRowTime.toFixed(2)}ms`);
    console.log(`TSV (UTF-8 decode + parse):   ${tsvTime.toFixed(2)}ms`);
    console.log(`TSV (string parse only):      ${tsvStringTime.toFixed(2)}ms`);
    console.log(`JSON (UTF-8 decode + parse):  ${jsonTime.toFixed(2)}ms`);
    console.log(`JSON (string parse only):     ${jsonStringTime.toFixed(2)}ms`);
    console.log();
    
    // Fair comparison - UTF-8 bytes to parsed data
    console.log("Fair UTF-8 Comparison:");
    console.log(`StringRow vs TSV (UTF-8):  ${(stringRowTime/tsvTime).toFixed(2)}x`);
    console.log(`StringRow vs JSON (UTF-8): ${(stringRowTime/jsonTime).toFixed(2)}x`);
    console.log();
    
    // UTF-8 decode overhead
    const tsvDecodeOverhead = tsvTime - tsvStringTime;
    const jsonDecodeOverhead = jsonTime - jsonStringTime;
    console.log("UTF-8 Decode Overhead:");
    console.log(`TSV decode overhead:  ${tsvDecodeOverhead.toFixed(2)}ms`);
    console.log(`JSON decode overhead: ${jsonDecodeOverhead.toFixed(2)}ms`);
    
    console.log("\n" + "=".repeat(60) + "\n");
  }
}

benchmarkWithUTF8();
