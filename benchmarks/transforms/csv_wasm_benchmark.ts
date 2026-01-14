import { enumerate } from "../../src/enumerable.ts";
import { fromCsvToLazyRows, fromCsvToRows } from "../../src/transforms/csv.ts";
import {
  fromCsvToLazyRowsFast,
  fromCsvToRowsFast,
} from "../../src/transforms/csv-fast.ts";

function generateCsvData(rows: number): Uint8Array {
  const lines = ["id,name,email,age,city"];
  for (let i = 0; i < rows; i++) {
    lines.push(
      `${i},User${i},user${i}@example.com,${25 + (i % 40)},City${i % 100}`,
    );
  }
  return new TextEncoder().encode(lines.join("\n") + "\n");
}

async function benchmark(
  name: string,
  fn: () => Promise<number>,
  iterations = 5,
  warmup = 2,
): Promise<number> {
  // Warmup runs
  for (let i = 0; i < warmup; i++) {
    await fn();
  }

  // Measured runs
  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]; // median
}

// Simulate streaming by yielding chunks
async function* chunkedStream(
  data: Uint8Array,
  chunkSize = 65536,
): AsyncIterable<Uint8Array> {
  for (let i = 0; i < data.length; i += chunkSize) {
    yield data.subarray(i, Math.min(i + chunkSize, data.length));
  }
}

async function runBenchmarks() {
  console.log("CSV WASM vs Standard Performance Comparison");
  console.log("============================================\n");

  for (const rowCount of [1000, 10000, 100000, 500000, 2000000]) {
    const data = generateCsvData(rowCount);
    const sizeMB = data.length / 1024 / 1024;

    console.log(
      `\n--- ${rowCount.toLocaleString()} rows (${sizeMB.toFixed(2)} MB) ---`,
    );

    // Standard implementation - streamed in 64KB chunks
    const stdTime = await benchmark("std", async () => {
      let count = 0;
      for await (const batch of fromCsvToRows()(chunkedStream(data))) {
        count += batch.length;
      }
      return count;
    });

    // WASM implementation - streamed in 64KB chunks
    const wasmTime = await benchmark("wasm", async () => {
      let count = 0;
      for await (const batch of fromCsvToRowsFast()(chunkedStream(data))) {
        count += batch.length;
      }
      return count;
    });

    const stdThroughput = sizeMB / (stdTime / 1000);
    const wasmThroughput = sizeMB / (wasmTime / 1000);
    const speedup = stdTime / wasmTime;

    console.log(
      `Standard:  ${stdTime.toFixed(1)}ms  (${stdThroughput.toFixed(1)} MB/s)`,
    );
    console.log(
      `WASM:      ${wasmTime.toFixed(1)}ms  (${
        wasmThroughput.toFixed(1)
      } MB/s)`,
    );
    console.log(`Speedup:   ${speedup.toFixed(2)}x`);
  }
}

runBenchmarks();
