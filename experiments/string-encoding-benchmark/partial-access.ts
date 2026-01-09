import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkPartialAccess() {
  console.log("Partial Column Access Performance");
  console.log("=================================\n");
  console.log("Scenario: 100 columns, accessing only first 5 columns\n");

  const iterations = 100;
  const testData = createTestData(100);
  
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  
  // Prepare UTF-8 data
  const stringRowBytes = StringRow.fromArray(testData).toBytes();
  const tsvBytes = encoder.encode(testData.join('\t'));
  const jsonBytes = encoder.encode(JSON.stringify(testData));

  console.log(`Data sizes: StringRow=${stringRowBytes.length}b, TSV=${tsvBytes.length}b, JSON=${jsonBytes.length}b\n`);

  // StringRow: UTF-8 bytes → StringRow → access first 5 columns
  const stringRowStart = performance.now();
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
  const stringRowTime = performance.now() - stringRowStart;

  // TSV: UTF-8 bytes → decode → split → access first 5
  const tsvStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(tsvBytes);
    const columns = decoded.split('\t');
    const values = [
      columns[0],
      columns[1],
      columns[2], 
      columns[3],
      columns[4]
    ];
  }
  const tsvTime = performance.now() - tsvStart;

  // JSON: UTF-8 bytes → decode → parse → access first 5
  const jsonStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(jsonBytes);
    const columns = JSON.parse(decoded);
    const values = [
      columns[0],
      columns[1],
      columns[2],
      columns[3], 
      columns[4]
    ];
  }
  const jsonTime = performance.now() - jsonStart;

  // Results
  console.log("Performance (accessing first 5 of 100 columns):");
  console.log(`StringRow: ${stringRowTime.toFixed(2)}ms (${(stringRowTime/iterations).toFixed(3)}ms/op)`);
  console.log(`TSV:       ${tsvTime.toFixed(2)}ms (${(tsvTime/iterations).toFixed(3)}ms/op)`);
  console.log(`JSON:      ${jsonTime.toFixed(2)}ms (${(jsonTime/iterations).toFixed(3)}ms/op)`);
  console.log();
  
  console.log("Relative performance:");
  console.log(`StringRow vs TSV:  ${(stringRowTime/tsvTime).toFixed(2)}x ${stringRowTime < tsvTime ? '(faster)' : '(slower)'}`);
  console.log(`StringRow vs JSON: ${(stringRowTime/jsonTime).toFixed(2)}x ${stringRowTime < jsonTime ? '(faster)' : '(slower)'}`);
  console.log();

  // Compare with full access scenario
  console.log("Comparison with full column access:");
  
  // Full access test
  const stringRowFullStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const row = new StringRow(stringRowBytes);
    const values = row.toArray(); // Access all 100 columns
  }
  const stringRowFullTime = performance.now() - stringRowFullStart;

  const tsvFullStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(tsvBytes);
    const columns = decoded.split('\t'); // Parse all 100 columns
  }
  const tsvFullTime = performance.now() - tsvFullStart;

  const jsonFullStart = performance.now();
  for (let i = 0; i < iterations; i++) {
    const decoded = decoder.decode(jsonBytes);
    const columns = JSON.parse(decoded); // Parse all 100 columns
  }
  const jsonFullTime = performance.now() - jsonFullStart;

  console.log(`StringRow partial vs full: ${(stringRowTime/stringRowFullTime).toFixed(2)}x (${stringRowTime < stringRowFullTime ? 'partial faster' : 'full faster'})`);
  console.log(`TSV partial vs full:       ${(tsvTime/tsvFullTime).toFixed(2)}x (${tsvTime < tsvFullTime ? 'partial faster' : 'full faster'})`);
  console.log(`JSON partial vs full:      ${(jsonTime/jsonFullTime).toFixed(2)}x (${jsonTime < jsonFullTime ? 'partial faster' : 'full faster'})`);
  
  console.log("\nStringRow advantage: Column access without parsing entire dataset");
}

benchmarkPartialAccess();
