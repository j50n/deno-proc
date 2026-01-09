import { StringRow } from "./string-row.ts";

function createTestData(columnCount: number): string[] {
  return Array.from({ length: columnCount }, (_, i) => `column_${i}_data_${Math.random().toString(36).substring(2)}`);
}

function benchmarkObjectCreation() {
  console.log("Object Creation vs Pure Parsing Performance");
  console.log("==========================================\n");

  const testCases = [
    { name: "Small rows", columns: 10, iterations: 1000 },
    { name: "Medium rows", columns: 50, iterations: 200 },
    { name: "Large rows", columns: 100, iterations: 100 }
  ];

  for (const testCase of testCases) {
    console.log(`${testCase.name}: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    const testData = createTestData(testCase.columns);
    const stringRowBytes = StringRow.fromArray(testData).toBytes();
    const tsvData = testData.join('\t');
    const jsonData = JSON.stringify(testData);

    // StringRow - Full object creation + access
    const stringRowFullStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const row = new StringRow(stringRowBytes);
      row.get(0); // Access first column
    }
    const stringRowFullTime = performance.now() - stringRowFullStart;

    // StringRow - Just object creation (no access)
    const stringRowCreateStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      new StringRow(stringRowBytes);
    }
    const stringRowCreateTime = performance.now() - stringRowCreateStart;

    // TSV - Full parsing + access
    const tsvFullStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = tsvData.split('\t');
      parsed[0]; // Access first element
    }
    const tsvFullTime = performance.now() - tsvFullStart;

    // TSV - Just parsing (no access)
    const tsvParseStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      tsvData.split('\t');
    }
    const tsvParseTime = performance.now() - tsvParseStart;

    // JSON - Full parsing + access
    const jsonFullStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      const parsed = JSON.parse(jsonData);
      parsed[0]; // Access first element
    }
    const jsonFullTime = performance.now() - jsonFullStart;

    // JSON - Just parsing (no access)
    const jsonParseStart = performance.now();
    for (let i = 0; i < testCase.iterations; i++) {
      JSON.parse(jsonData);
    }
    const jsonParseTime = performance.now() - jsonParseStart;

    // Results
    console.log(`StringRow (create + access): ${stringRowFullTime.toFixed(2)}ms`);
    console.log(`StringRow (create only):     ${stringRowCreateTime.toFixed(2)}ms`);
    console.log(`StringRow access overhead:   ${(stringRowFullTime - stringRowCreateTime).toFixed(2)}ms`);
    console.log();
    console.log(`TSV (parse + access):        ${tsvFullTime.toFixed(2)}ms`);
    console.log(`TSV (parse only):            ${tsvParseTime.toFixed(2)}ms`);
    console.log(`TSV access overhead:         ${(tsvFullTime - tsvParseTime).toFixed(2)}ms`);
    console.log();
    console.log(`JSON (parse + access):       ${jsonFullTime.toFixed(2)}ms`);
    console.log(`JSON (parse only):           ${jsonParseTime.toFixed(2)}ms`);
    console.log(`JSON access overhead:        ${(jsonFullTime - jsonParseTime).toFixed(2)}ms`);
    console.log();
    
    // Object creation overhead analysis
    console.log("Object Creation Overhead Analysis:");
    console.log(`StringRow creation: ${stringRowCreateTime.toFixed(2)}ms vs TSV parse: ${tsvParseTime.toFixed(2)}ms (${(stringRowCreateTime/tsvParseTime).toFixed(2)}x)`);
    console.log(`StringRow creation: ${stringRowCreateTime.toFixed(2)}ms vs JSON parse: ${jsonParseTime.toFixed(2)}ms (${(stringRowCreateTime/jsonParseTime).toFixed(2)}x)`);
    
    console.log("\n" + "=".repeat(60) + "\n");
  }
}

benchmarkObjectCreation();
