import { enumerate } from "../../src/enumerable.ts";
import { 
  fromCsvToRows, fromCsvToLazyRows, toCsv,
  fromTsvToRows, fromTsvToLazyRows, toTsv,
  fromJsonToRows, toJson,
  fromRecordToRows, fromRecordToLazyRows, toRecord,
  type LazyRow, FIELD_SEPARATOR, RECORD_SEPARATOR
} from "../../src/transforms/mod.ts";

function generateTestData(rows: number) {
  return Array.from({ length: rows }, (_, i) => ({
    id: i.toString(),
    name: `User${i}`,
    email: `user${i}@example.com`,
    age: (25 + (i % 40)).toString(),
    city: `City${i % 100}`,
  }));
}

function dataToFormats(data: Record<string, string>[]) {
  const csvHeaders = Object.keys(data[0]).join(',');
  const csvRows = data.map(row => Object.values(row).join(','));
  const csv = [csvHeaders, ...csvRows].join('\n');
  
  const tsvHeaders = Object.keys(data[0]).join('\t');
  const tsvRows = data.map(row => Object.values(row).join('\t'));
  const tsv = [tsvHeaders, ...tsvRows].join('\n');
  
  const jsonl = data.map(row => JSON.stringify(row)).join('\n');
  
  const recordData = data.map(row => Object.values(row).join(FIELD_SEPARATOR)).join(RECORD_SEPARATOR) + RECORD_SEPARATOR;
  
  return { csv, tsv, jsonl, record: recordData };
}

// Separate benchmark functions for different return types
async function benchmarkRowParser(name: string, data: string, parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<string[][]>, iterations = 3) {
  const bytes = new TextEncoder().encode(data);
  const times: number[] = [];
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([bytes]).transform(parser()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) resultCount = result.flat().length;
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = bytes.length / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${name.padEnd(20)} ${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, resultCount };
}

async function benchmarkObjectParser(name: string, data: string, parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<Record<string, string>[]>, iterations = 3) {
  const bytes = new TextEncoder().encode(data);
  const times: number[] = [];
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([bytes]).transform(parser()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) resultCount = result.flat().length;
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = bytes.length / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${name.padEnd(20)} ${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, resultCount };
}

async function benchmarkLazyRowParser(name: string, data: string, parser: () => (input: AsyncIterable<Uint8Array>) => AsyncIterable<LazyRow[]>, iterations = 3) {
  const bytes = new TextEncoder().encode(data);
  const times: number[] = [];
  let resultCount = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([bytes]).transform(parser()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) resultCount = result.flat().length;
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = bytes.length / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${name.padEnd(20)} ${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, resultCount };
}

async function benchmarkRowStringifier(name: string, data: string[][], stringifier: () => (input: AsyncIterable<string[][]>) => AsyncIterable<Uint8Array>, iterations = 3) {
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([data]).transform(stringifier()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = outputSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${name.padEnd(20)} ${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, outputSize };
}

async function _benchmarkLazyRowStringifier(testData: LazyRow[], stringifier: () => (input: AsyncIterable<LazyRow[]>) => AsyncIterable<Uint8Array>, format: string, iterations = 3) {
  console.log(`${format.padEnd(20)} `, { end: "" });
  
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([testData]).transform(stringifier()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = outputSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, outputSize };
}

async function benchmarkObjectStringifier(name: string, data: Record<string, string>[], stringifier: () => (input: AsyncIterable<Record<string, string>[]>) => AsyncIterable<Uint8Array>, iterations = 3) {
  const times: number[] = [];
  let outputSize = 0;
  
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = await enumerate([data]).transform(stringifier()).collect();
    const end = performance.now();
    times.push(end - start);
    if (i === 0) outputSize = result.reduce((sum, chunk) => sum + chunk.length, 0);
  }
  
  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const throughput = outputSize / 1024 / 1024 / (avgTime / 1000);
  
  console.log(`${name.padEnd(20)} ${avgTime.toFixed(2).padStart(8)}ms ${throughput.toFixed(2).padStart(8)} MB/s`);
  return { time: avgTime, throughput, outputSize };
}

async function runComparativeAnalysis() {
  console.log("Transform Functions Comparative Analysis");
  console.log("=======================================\n");
  
  const testSizes = [
    { name: "Small (1K rows)", rows: 1000 },
    { name: "Medium (10K rows)", rows: 10000 },
    { name: "Large (50K rows)", rows: 50000 }
  ];
  
  for (const { name, rows } of testSizes) {
    console.log(`\n=== ${name} ===`);
    
    const testData = generateTestData(rows);
    const formats = dataToFormats(testData);
    
    console.log(`Data size: CSV ${(formats.csv.length / 1024).toFixed(1)}KB, TSV ${(formats.tsv.length / 1024).toFixed(1)}KB, JSON ${(formats.jsonl.length / 1024).toFixed(1)}KB, Record ${(formats.record.length / 1024).toFixed(1)}KB`);
    
    // Parsing benchmarks
    console.log("\nParsing Performance:");
    console.log("Format               Time     Throughput");
    console.log("--------------------  --------  ----------");
    
    const csvRows = await benchmarkRowParser("CSV → Rows", formats.csv, fromCsvToRows);
    const csvLazy = await benchmarkLazyRowParser("CSV → LazyRows", formats.csv, fromCsvToLazyRows);
    const tsvRows = await benchmarkObjectParser("TSV → Rows", formats.tsv, fromTsvToRows);
    const tsvLazy = await benchmarkLazyRowParser("TSV → LazyRows", formats.tsv, fromTsvToLazyRows);
    const jsonRows = await benchmarkRowParser("JSON → Rows", formats.jsonl, fromJsonToRows);
    const recordRows = await benchmarkRowParser("Record → Rows", formats.record, fromRecordToRows);
    const recordLazy = await benchmarkLazyRowParser("Record → LazyRows", formats.record, fromRecordToLazyRows);
    
    // Stringify benchmarks
    console.log("\nStringify Performance:");
    console.log("Format               Time     Throughput");
    console.log("--------------------  --------  ----------");
    
    const rowData = testData.map(obj => Object.values(obj));
    const objectData = testData; // TSV uses Record<string, string>
    
    await benchmarkRowStringifier("Rows → CSV", rowData, toCsv);
    await benchmarkObjectStringifier("Objects → TSV", objectData, toTsv);
    await benchmarkObjectStringifier("Objects → JSON", testData, toJson);
    await benchmarkRowStringifier("Rows → Record", rowData, toRecord);
    
    // LazyRow vs Row comparison
    console.log("\nLazyRow vs Row Performance:");
    console.log(`CSV:    LazyRow ${(csvLazy.throughput / csvRows.throughput).toFixed(2)}x faster than Rows`);
    console.log(`TSV:    LazyRow ${(tsvLazy.throughput / tsvRows.throughput).toFixed(2)}x faster than Rows`);
    console.log(`Record: LazyRow ${(recordLazy.throughput / recordRows.throughput).toFixed(2)}x faster than Rows`);
    
    // Format comparison
    console.log("\nFormat Efficiency (parsing throughput):");
    const parsers = [
      { name: "CSV", throughput: csvRows.throughput },
      { name: "TSV", throughput: tsvRows.throughput },
      { name: "JSON", throughput: jsonRows.throughput },
      { name: "Record", throughput: recordRows.throughput }
    ].sort((a, b) => b.throughput - a.throughput);
    
    parsers.forEach((parser, i) => {
      console.log(`${i + 1}. ${parser.name}: ${parser.throughput.toFixed(2)} MB/s`);
    });
  }
}

// Run the analysis
await runComparativeAnalysis();
