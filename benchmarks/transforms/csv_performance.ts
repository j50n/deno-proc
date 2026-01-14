// deno-lint-ignore-file no-unused-vars
import { enumerate } from "../../src/enumerable.ts";
import { fromCsvToRows, fromCsvToLazyRows, toCsv } from "../../src/transforms/mod.ts";

// Generate test CSV data
function generateCsvData(rows: number): string {
  const headers = "id,name,email,age,city,country,salary";
  const data = [headers];
  
  for (let i = 0; i < rows; i++) {
    data.push(`${i},User${i},user${i}@example.com,${25 + (i % 40)},City${i % 100},Country${i % 20},${30000 + (i % 70000)}`);
  }
  
  return data.join('\n');
}

async function benchmarkCsvParsing(name: string, data: string, iterations = 3) {
  const bytes = new TextEncoder().encode(data);
  const dataSize = bytes.length;
  
  console.log(`\n=== ${name} ===`);
  console.log(`Data size: ${(dataSize / 1024 / 1024).toFixed(2)} MB`);
  
  // Benchmark fromCsvToRows
  const rowTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([bytes]).transform(fromCsvToRows()).collect();
    const end = performance.now();
    rowTimes.push(end - start);
    if (i === 0) console.log(`Rows parsed: ${result.flat().length}`);
  }
  
  // Benchmark fromCsvToLazyRows  
  const lazyTimes: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([bytes]).transform(fromCsvToLazyRows()).collect();
    const end = performance.now();
    lazyTimes.push(end - start);
  }
  
  const avgRowTime = rowTimes.reduce((a, b) => a + b) / rowTimes.length;
  const avgLazyTime = lazyTimes.reduce((a, b) => a + b) / lazyTimes.length;
  
  console.log(`fromCsvToRows:     ${avgRowTime.toFixed(2)}ms (${(dataSize / 1024 / 1024 / (avgRowTime / 1000)).toFixed(2)} MB/s)`);
  console.log(`fromCsvToLazyRows: ${avgLazyTime.toFixed(2)}ms (${(dataSize / 1024 / 1024 / (avgLazyTime / 1000)).toFixed(2)} MB/s)`);
  console.log(`LazyRow advantage: ${(avgRowTime / avgLazyTime).toFixed(2)}x faster`);
}

async function benchmarkCsvStringify(name: string, rowCount: number, iterations = 3) {
  // Generate test data
  const testRows = [];
  for (let i = 0; i < rowCount; i++) {
    testRows.push([`${i}`, `User${i}`, `user${i}@example.com`, `${25 + (i % 40)}`]);
  }
  
  console.log(`\n=== ${name} Stringify ===`);
  console.log(`Rows: ${rowCount}`);
  
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([testRows]).transform(toCsv()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  console.log(`toCsv: ${avgTime.toFixed(2)}ms (${(outputSize / 1024 / 1024 / (avgTime / 1000)).toFixed(2)} MB/s)`);
  console.log(`Output size: ${(outputSize / 1024 / 1024).toFixed(2)} MB`);
}

// Run benchmarks
console.log("CSV Transform Performance Benchmarks");
console.log("====================================");

await benchmarkCsvParsing("Small Dataset (1K rows)", generateCsvData(1000));
await benchmarkCsvParsing("Medium Dataset (10K rows)", generateCsvData(10000));
await benchmarkCsvParsing("Large Dataset (100K rows)", generateCsvData(100000));

await benchmarkCsvStringify("Small Dataset", 1000);
await benchmarkCsvStringify("Medium Dataset", 10000);
await benchmarkCsvStringify("Large Dataset", 100000);
