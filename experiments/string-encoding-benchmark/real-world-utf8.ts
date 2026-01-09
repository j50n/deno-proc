import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkRealWorldUTF8() {
  console.log("Real-World UTF-8 Performance Comparison");
  console.log("=======================================\n");

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
    
    // Pre-encode all formats to UTF-8 bytes (as they would come from network/file)
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvString = testData.join('\t');
    const tsvBytes = encoder.encode(tsvString);
    const jsonString = JSON.stringify(testData);
    const jsonBytes = encoder.encode(jsonString);

    console.log(`Data sizes - StringRow: ${stringRowBytes.length}b, TSV: ${tsvBytes.length}b, JSON: ${jsonBytes.length}b\n`);

    // StringRow - direct from UTF-8 bytes (no decode step needed)
    const stringRowStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      row.get(0); // Access first column
    }
    const stringRowTime = performance.now() - stringRowStart;

    // TSV - realistic: decode UTF-8 bytes then split
    const tsvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(tsvBytes);
      const parsed = decoded.split('\t');
      parsed[0]; // Access first element
    }
    const tsvTime = performance.now() - tsvStart;

    // JSON - realistic: decode UTF-8 bytes then parse JSON
    const jsonStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(jsonBytes);
      const parsed = JSON.parse(decoded);
      parsed[0]; // Access first element
    }
    const jsonTime = performance.now() - jsonStart;

    // Alternative: JSON parsing directly from UTF-8 bytes (if supported)
    // Note: JSON.parse() in JavaScript actually expects a string, not bytes
    // So the decode step is always required for JSON
    
    // Results
    console.log("Performance (UTF-8 bytes → parsed data):");
    console.log(`StringRow: ${stringRowTime.toFixed(2)}ms (${(stringRowTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:       ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:      ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log();
    
    console.log("Performance ratios:");
    console.log(`StringRow vs TSV:  ${(stringRowTime/tsvTime).toFixed(2)}x`);
    console.log(`StringRow vs JSON: ${(stringRowTime/jsonTime).toFixed(2)}x`);
    console.log();
    
    // Throughput analysis
    const stringRowThroughput = (stringRowBytes.length * testCase.iterations) / (stringRowTime * 1000); // KB/ms
    const tsvThroughput = (tsvBytes.length * testCase.iterations) / (tsvTime * 1000);
    const jsonThroughput = (jsonBytes.length * testCase.iterations) / (jsonTime * 1000);
    
    console.log("Throughput (KB/ms):");
    console.log(`StringRow: ${stringRowThroughput.toFixed(1)} KB/ms`);
    console.log(`TSV:       ${tsvThroughput.toFixed(1)} KB/ms`);
    console.log(`JSON:      ${jsonThroughput.toFixed(1)} KB/ms`);
    
    console.log("\n" + "=".repeat(60) + "\n");
  }

  // Note about JSON parsing
  console.log("📝 Note: JSON.parse() in JavaScript always requires a string input,");
  console.log("   so UTF-8 decode is mandatory for JSON parsing from bytes.");
  console.log("   StringRow works directly with UTF-8 bytes, eliminating this step.");
}

benchmarkRealWorldUTF8();
