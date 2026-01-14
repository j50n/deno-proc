#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run
/**
 * Benchmark throughput of all flatdata format conversions.
 *
 * Tests all 12 conversion commands with consistent test data:
 * - 20 columns per record
 * - 100,000 records
 * - ~10MB of data
 *
 * Measures throughput in MB/s for each conversion.
 */

const FLATDATA =
  new URL("../scripts/flatdata/flatdata.ts", import.meta.url).pathname;
const TEMP_DIR = "/tmp/flatdata-bench";
const NUM_RECORDS = 100_000;
const NUM_COLUMNS = 20;

// Generate test data files
async function generateTestData() {
  try {
    await Deno.mkdir(TEMP_DIR, { recursive: true });
  } catch {
    // Directory already exists
  }

  console.log(
    `Generating test data: ${NUM_RECORDS} records × ${NUM_COLUMNS} columns...`,
  );

  // Generate CSV
  const csvLines: string[] = [];
  for (let i = 0; i < NUM_RECORDS; i++) {
    const fields = Array.from(
      { length: NUM_COLUMNS },
      (_, j) => `field${j}_${i}`,
    );
    csvLines.push(fields.join(","));
  }
  const csvData = csvLines.join("\n") + "\n";
  await Deno.writeTextFile(`${TEMP_DIR}/test.csv`, csvData);

  // Generate TSV
  const tsvData = csvData.replaceAll(",", "\t");
  await Deno.writeTextFile(`${TEMP_DIR}/test.tsv`, tsvData);

  // Generate Record format
  const recordData = csvData.replaceAll(",", "\x1F").replaceAll("\n", "\x1E");
  await Deno.writeTextFile(`${TEMP_DIR}/test.rec`, recordData);

  // Generate LazyRow binary (via conversion)
  const cmd = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-read",
      "--allow-write",
      FLATDATA,
      "csv2lazyrow",
      "-i",
      `${TEMP_DIR}/test.csv`,
      "-o",
      `${TEMP_DIR}/test.lazy`,
    ],
    stdout: "piped",
    stderr: "piped",
  });
  const { success, stderr } = await cmd.output();
  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Failed to generate lazyrow file: ${error}`);
  }

  const csvSize = (await Deno.stat(`${TEMP_DIR}/test.csv`)).size;
  const tsvSize = (await Deno.stat(`${TEMP_DIR}/test.tsv`)).size;
  const recSize = (await Deno.stat(`${TEMP_DIR}/test.rec`)).size;
  const lazySize = (await Deno.stat(`${TEMP_DIR}/test.lazy`)).size;

  console.log(`  CSV:    ${(csvSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  TSV:    ${(tsvSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  Record: ${(recSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`  LazyRow: ${(lazySize / 1024 / 1024).toFixed(2)} MB`);
  console.log();
}

// Benchmark a single conversion
async function benchmarkConversion(
  name: string,
  command: string,
  inputFile: string,
): Promise<{ throughput: number; time: number; size: number }> {
  const inputSize = (await Deno.stat(inputFile)).size;

  const cmd = new Deno.Command("deno", {
    args: ["run", "--allow-read", FLATDATA, command, "-i", inputFile],
    stdout: "null",
    stderr: "piped",
  });

  const start = performance.now();
  const { success, stderr } = await cmd.output();
  const elapsed = (performance.now() - start) / 1000; // seconds

  if (!success) {
    const error = new TextDecoder().decode(stderr);
    throw new Error(`Command failed: ${error}`);
  }

  const throughput = (inputSize / 1024 / 1024) / elapsed; // MB/s

  return { throughput, time: elapsed, size: inputSize };
}

// Run all benchmarks
async function runBenchmarks() {
  await generateTestData();

  const conversions = [
    // CSV conversions
    {
      name: "csv2record",
      command: "csv2record",
      input: `${TEMP_DIR}/test.csv`,
    },
    {
      name: "csv2lazyrow",
      command: "csv2lazyrow",
      input: `${TEMP_DIR}/test.csv`,
    },
    { name: "csv2tsv", command: "csv2tsv", input: `${TEMP_DIR}/test.csv` },

    // TSV conversions
    {
      name: "tsv2record",
      command: "tsv2record",
      input: `${TEMP_DIR}/test.tsv`,
    },
    {
      name: "tsv2lazyrow",
      command: "tsv2lazyrow",
      input: `${TEMP_DIR}/test.tsv`,
    },
    { name: "tsv2csv", command: "tsv2csv", input: `${TEMP_DIR}/test.tsv` },

    // Record conversions
    {
      name: "record2csv",
      command: "record2csv",
      input: `${TEMP_DIR}/test.rec`,
    },
    {
      name: "record2tsv",
      command: "record2tsv",
      input: `${TEMP_DIR}/test.rec`,
    },
    {
      name: "record2lazyrow",
      command: "record2lazyrow",
      input: `${TEMP_DIR}/test.rec`,
    },

    // LazyRow conversions
    {
      name: "lazyrow2csv",
      command: "lazyrow2csv",
      input: `${TEMP_DIR}/test.lazy`,
    },
    {
      name: "lazyrow2tsv",
      command: "lazyrow2tsv",
      input: `${TEMP_DIR}/test.lazy`,
    },
    {
      name: "lazyrow2record",
      command: "lazyrow2record",
      input: `${TEMP_DIR}/test.lazy`,
    },
  ];

  console.log("Running benchmarks...\n");
  console.log("Command              Time(s)   Throughput(MB/s)");
  console.log("=================================================");

  const results: Array<{ name: string; throughput: number; time: number }> = [];

  for (const { name, command, input } of conversions) {
    const result = await benchmarkConversion(name, command, input);
    results.push({ name, throughput: result.throughput, time: result.time });
    console.log(
      `${name.padEnd(20)} ${result.time.toFixed(3).padStart(7)}   ${
        result.throughput.toFixed(1).padStart(6)
      }`,
    );
  }

  console.log("\n=================================================");
  console.log("\nSummary:");

  // Group by source format
  const csvConversions = results.filter((r) => r.name.startsWith("csv2"));
  const tsvConversions = results.filter((r) => r.name.startsWith("tsv2"));
  const recConversions = results.filter((r) => r.name.startsWith("record2"));
  const lazyConversions = results.filter((r) => r.name.startsWith("lazyrow2"));

  const avgThroughput = (conversions: typeof results) =>
    conversions.reduce((sum, r) => sum + r.throughput, 0) / conversions.length;

  console.log(
    `  CSV conversions:     ${
      avgThroughput(csvConversions).toFixed(1)
    } MB/s avg`,
  );
  console.log(
    `  TSV conversions:     ${
      avgThroughput(tsvConversions).toFixed(1)
    } MB/s avg`,
  );
  console.log(
    `  Record conversions:  ${
      avgThroughput(recConversions).toFixed(1)
    } MB/s avg`,
  );
  console.log(
    `  LazyRow conversions: ${
      avgThroughput(lazyConversions).toFixed(1)
    } MB/s avg`,
  );
  console.log(
    `  Overall average:     ${avgThroughput(results).toFixed(1)} MB/s`,
  );
}

// Cleanup
async function cleanup() {
  try {
    await Deno.remove(TEMP_DIR, { recursive: true });
  } catch {
    // Ignore errors
  }
}

// Main
if (import.meta.main) {
  try {
    await runBenchmarks();
  } finally {
    await cleanup();
  }
}
