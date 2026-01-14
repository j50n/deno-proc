import { enumerate } from "../../src/enumerable.ts";
import { 
  fromCsvToRows, fromCsvToLazyRows, toCsv,
  fromTsvToRows, fromTsvToLazyRows, toTsv,
  fromJsonToRows, toJson,
  type LazyRow
} from "../../src/transforms/mod.ts";

function sanityCheck<T>(result: T[][], expectedMinRows: number, format: string): boolean {
  const totalRows = result.flat().length;
  if (totalRows < expectedMinRows * 0.8) {
    console.warn(`⚠️  ${format}: Expected ~${expectedMinRows} rows, got ${totalRows}`);
    return false;
  }
  return true;
}

// Separate benchmark functions for different return types
async function benchmarkRowParser(
  filename: string, 
  parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<string[][]>, 
  expectedRows: number,
  format: string,
  iterations = 3
) {
  console.log(`${format.padEnd(25)} `, { end: "" });
  
  const times: number[] = [];
  let fileSize = 0;
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const file = await Deno.open(`benchmarks/data/${filename}`);
    if (i === 0) {
      const stat = await file.stat();
      fileSize = stat.size;
    }
    
    const start = performance.now();
    const result = await enumerate(file.readable).transform(parser()).collect();
    const end = performance.now();
    
    try { file.close(); } catch { /* already closed */ }
    times.push(end - start);
    
    if (i === 0) {
      resultCount = result.flat().length;
      if (!sanityCheck(result, expectedRows, format)) {
        console.log("❌ FAILED");
        return null;
      }
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = fileSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s ${resultCount.toLocaleString().padStart(8)} rows`);
  return { time: avgTime, throughput, rows: resultCount, fileSize };
}

async function benchmarkObjectParser(
  filename: string, 
  parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<Record<string, string>[]>, 
  expectedRows: number,
  format: string,
  iterations = 3
) {
  console.log(`${format.padEnd(25)} `, { end: "" });
  
  const times: number[] = [];
  let fileSize = 0;
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const file = await Deno.open(`benchmarks/data/${filename}`);
    if (i === 0) {
      const stat = await file.stat();
      fileSize = stat.size;
    }
    
    const start = performance.now();
    const result = await enumerate(file.readable).transform(parser()).collect();
    const end = performance.now();
    
    try { file.close(); } catch { /* already closed */ }
    times.push(end - start);
    
    if (i === 0) {
      resultCount = result.flat().length;
      if (!sanityCheck(result, expectedRows, format)) {
        console.log("❌ FAILED");
        return null;
      }
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = fileSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s ${resultCount.toLocaleString().padStart(8)} rows`);
  return { time: avgTime, throughput, rows: resultCount, fileSize };
}

async function benchmarkLazyRowParser(
  filename: string, 
  parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<LazyRow[]>, 
  expectedRows: number,
  format: string,
  iterations = 3
) {
  console.log(`${format.padEnd(25)} `, { end: "" });
  
  const times: number[] = [];
  let fileSize = 0;
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const file = await Deno.open(`benchmarks/data/${filename}`);
    if (i === 0) {
      const stat = await file.stat();
      fileSize = stat.size;
    }
    
    const start = performance.now();
    const result = await enumerate(file.readable).transform(parser()).collect();
    const end = performance.now();
    
    try { file.close(); } catch { /* already closed */ }
    times.push(end - start);
    
    if (i === 0) {
      resultCount = result.flat().length;
      if (!sanityCheck(result, expectedRows, format)) {
        console.log("❌ FAILED");
        return null;
      }
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = fileSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s ${resultCount.toLocaleString().padStart(8)} rows`);
  return { time: avgTime, throughput, rows: resultCount, fileSize };
}

async function benchmarkRowStringifier(testData: string[][], stringifier: () => (input: AsyncIterable<string[][]>) => AsyncIterable<Uint8Array>, format: string, iterations = 3) {
  console.log(`${format.padEnd(25)} `, { end: "" });
  
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([testData]).transform(stringifier()).collect();
    const end = performance.now();
    
    times.push(end - start);
    if (i === 0) {
      outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = outputSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s ${(outputSize / 1024 / 1024).toFixed(2).padStart(8)} MB`);
  return { time: avgTime, throughput, outputSize };
}

async function benchmarkObjectStringifier(testData: Record<string, string>[], stringifier: () => (input: AsyncIterable<Record<string, string>[]>) => AsyncIterable<Uint8Array>, format: string, iterations = 3) {
  console.log(`${format.padEnd(25)} `, { end: "" });
  
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([testData]).transform(stringifier()).collect();
    const end = performance.now();
    
    times.push(end - start);
    if (i === 0) {
      outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
    }
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = outputSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s ${(outputSize / 1024 / 1024).toFixed(2).padStart(8)} MB`);
  return { time: avgTime, throughput, outputSize };
}

async function runStreamingBenchmarks() {
  console.log("Streaming Transform Performance Benchmarks");
  console.log("==========================================\n");
  
  // Test configurations: [filename, expectedRows, description]
  const testConfigs: [string, number, string][] = [
    ["small_10col.csv", 1000, "Small 10-column"],
    ["small_100col.csv", 100, "Small 100-column"], 
    ["medium_10col.csv", 50000, "Medium 10-column"],
    ["medium_100col.csv", 10000, "Medium 100-column"],
  ];
  
  // Check if large files exist
  try {
    await Deno.stat("benchmarks/data/large_10col.csv");
    testConfigs.push(["large_10col.csv", 200000, "Large 10-column"]);
  } catch {
    console.log("ℹ️  Large datasets not found, skipping. Run ./benchmarks/data/generate_datasets.ts to create them.\n");
  }
  
  for (const [filename, expectedRows, description] of testConfigs) {
    console.log(`=== ${description} Dataset ===`);
    
    try {
      const stat = await Deno.stat(`benchmarks/data/${filename}`);
      console.log(`File: ${filename} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    } catch {
      console.log(`❌ File not found: ${filename}`);
      continue;
    }
    
    console.log("\nParsing Performance:");
    console.log("Format                    Time     Throughput    Rows");
    console.log("------------------------  --------  ----------  --------");
    
    // CSV benchmarks
    const csvRows = await benchmarkRowParser(filename, fromCsvToRows, expectedRows, "CSV → Rows");
    const csvLazy = await benchmarkLazyRowParser(filename, fromCsvToLazyRows, expectedRows, "CSV → LazyRows");
    
    // TSV benchmarks (use corresponding TSV file)
    const tsvFilename = filename.replace('.csv', '.tsv');
    const tsvRows = await benchmarkObjectParser(tsvFilename, fromTsvToRows, expectedRows, "TSV → Rows");
    const tsvLazy = await benchmarkLazyRowParser(tsvFilename, fromTsvToLazyRows, expectedRows, "TSV → LazyRows");
    
    // JSON benchmarks (use corresponding JSON file)
    const jsonFilename = filename.replace('.csv', '.json');
    const jsonRows = await benchmarkRowParser(jsonFilename, fromJsonToRows, expectedRows, "JSON → Rows");
    
    // Stringify benchmarks (create test data from first successful parse)
    if (csvRows) {
      console.log("\nStringify Performance:");
      console.log("Format                    Time     Throughput   Output");
      console.log("------------------------  --------  ----------  --------");
      
      // Generate test data for stringify benchmarks
      const sampleSize = Math.min(1000, expectedRows);
      const testRowData = Array.from({ length: sampleSize }, (_, i) => 
        Array.from({ length: 10 }, (_, j) => `field_${i}_${j}`)
      );
      const testObjectData = Array.from({ length: sampleSize }, (_, i) => 
        Object.fromEntries(Array.from({ length: 10 }, (_, j) => [`column_${j}`, `field_${i}_${j}`]))
      );
      
      await benchmarkRowStringifier(testRowData, toCsv, "Rows → CSV");
      await benchmarkObjectStringifier(testObjectData, toTsv, "Objects → TSV");
      await benchmarkObjectStringifier(testObjectData, toJson, "Objects → JSON");
    }
    
    // Performance comparison
    if (csvRows && csvLazy && tsvRows && tsvLazy && jsonRows) {
      console.log("\nPerformance Summary:");
      console.log(`LazyRow vs Rows - CSV: ${(csvLazy.throughput / csvRows.throughput).toFixed(2)}x`);
      console.log(`LazyRow vs Rows - TSV: ${(tsvLazy.throughput / tsvRows.throughput).toFixed(2)}x`);
      
      const formats = [
        { name: "CSV", throughput: csvRows.throughput },
        { name: "TSV", throughput: tsvRows.throughput },
        { name: "JSON", throughput: jsonRows.throughput }
      ].sort((a, b) => b.throughput - a.throughput);
      
      console.log("\nFormat Ranking (parsing speed):");
      formats.forEach((fmt, i) => {
        console.log(`${i + 1}. ${fmt.name}: ${fmt.throughput.toFixed(2)} MB/s`);
      });
    }
    
    console.log("\n" + "=".repeat(50) + "\n");
  }
}

// Run the streaming benchmarks
await runStreamingBenchmarks();
