import { StringRow } from "./string-row.ts";
import { parse } from "https://deno.land/std@0.208.0/csv/parse.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkWithDenoCSV() {
  console.log("UTF-8 Performance: StringRow vs TSV vs JSON vs Deno CSV");
  console.log("======================================================\n");

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
    // CSV with proper escaping
    const csvString = testData.map(col => `"${col.replace(/"/g, '""')}"`).join(',');
    const csvBytes = encoder.encode(csvString);

    console.log(`Data sizes - StringRow: ${stringRowBytes.length}b, TSV: ${tsvBytes.length}b, JSON: ${jsonBytes.length}b, CSV: ${csvBytes.length}b`);

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

      // Deno CSV warmup
      const csvDecoded = decoder.decode(csvBytes);
      const csvParsed = parse(csvDecoded, { skipFirstRow: false });
      csvParsed[0][0];
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

    // Deno CSV test
    const csvStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const decoded = decoder.decode(csvBytes);
      const parsed = parse(decoded, { skipFirstRow: false });
      parsed[0][0];
    }
    const csvTime = performance.now() - csvStart;

    // Results
    console.log("Performance (UTF-8 bytes → parsed data):");
    console.log(`StringRow:  ${stringRowTime.toFixed(2)}ms (${(stringRowTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`TSV:        ${tsvTime.toFixed(2)}ms (${(tsvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`JSON:       ${jsonTime.toFixed(2)}ms (${(jsonTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log(`Deno CSV:   ${csvTime.toFixed(2)}ms (${(csvTime/testCase.iterations).toFixed(3)}ms/op)`);
    console.log();
    
    console.log("Relative performance vs StringRow:");
    console.log(`TSV:      ${(tsvTime/stringRowTime).toFixed(2)}x ${tsvTime > stringRowTime ? 'slower' : 'faster'}`);
    console.log(`JSON:     ${(jsonTime/stringRowTime).toFixed(2)}x ${jsonTime > stringRowTime ? 'slower' : 'faster'}`);
    console.log(`Deno CSV: ${(csvTime/stringRowTime).toFixed(2)}x ${csvTime > stringRowTime ? 'slower' : 'faster'}`);
    
    // Throughput
    const stringRowThroughput = (stringRowBytes.length * testCase.iterations) / (stringRowTime * 1000);
    const tsvThroughput = (tsvBytes.length * testCase.iterations) / (tsvTime * 1000);
    const jsonThroughput = (jsonBytes.length * testCase.iterations) / (jsonTime * 1000);
    const csvThroughput = (csvBytes.length * testCase.iterations) / (csvTime * 1000);
    
    console.log();
    console.log("Throughput (KB/ms):");
    console.log(`StringRow:  ${stringRowThroughput.toFixed(1)} KB/ms`);
    console.log(`TSV:        ${tsvThroughput.toFixed(1)} KB/ms`);
    console.log(`JSON:       ${jsonThroughput.toFixed(1)} KB/ms`);
    console.log(`Deno CSV:   ${csvThroughput.toFixed(1)} KB/ms`);
    
    console.log("\n" + "=".repeat(60) + "\n");
  }

  console.log("📝 Notes:");
  console.log("• StringRow works directly with UTF-8 bytes");
  console.log("• Text formats require UTF-8 decode + parsing");
  console.log("• Deno CSV handles proper escaping and edge cases");
  console.log("• All measurements include UTF-8 decode overhead for fair comparison");
}

benchmarkWithDenoCSV();
