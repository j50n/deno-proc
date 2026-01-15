#!/usr/bin/env -S deno run --allow-read --allow-run

interface BenchmarkResult {
  approach: string;
  file: string;
  fileSize: number;
  duration: number;
  throughput: number;
}

const approaches = [
  { name: "sync", script: "sync.ts" },
  { name: "async_simple", script: "async_simple.ts" },
  { name: "async_buffered", script: "async_buffered.ts" },
  { name: "async_queued", script: "async_queued.ts" },
];

const testFiles = [
  { name: "small.txt", path: "data/small.txt" },
  { name: "medium.txt", path: "data/medium.txt" },
  { name: "large.txt", path: "data/large.txt" },
];

async function getFileSize(path: string): Promise<number> {
  const stat = await Deno.stat(path);
  return stat.size;
}

async function runBenchmark(script: string, filePath: string): Promise<number> {
  const start = performance.now();
  
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-read", script, filePath],
    stdout: "null",
    stderr: "inherit",
  });
  
  const { success } = await command.output();
  
  if (!success) {
    throw new Error(`Benchmark failed for ${script} with ${filePath}`);
  }
  
  const end = performance.now();
  return end - start;
}

const results: BenchmarkResult[] = [];

console.log("Running warmup...");
for (const approach of approaches) {
  await runBenchmark(approach.script, testFiles[0].path);
}
console.log("Warmup complete.\n");

console.log("Running benchmarks...\n");

for (const file of testFiles) {
  const fileSize = await getFileSize(file.path);
  console.log(`Testing ${file.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
  
  for (const approach of approaches) {
    process.stdout.write(`  ${approach.name.padEnd(20)}`);
    
    const duration = await runBenchmark(approach.script, file.path);
    const throughput = (fileSize / 1024 / 1024) / (duration / 1000);
    
    results.push({
      approach: approach.name,
      file: file.name,
      fileSize,
      duration,
      throughput,
    });
    
    console.log(`${duration.toFixed(2)}ms (${throughput.toFixed(2)} MB/s)`);
  }
  
  console.log();
}

// Write results to CSV
const csv = [
  "approach,file,file_size_mb,duration_ms,throughput_mb_s",
  ...results.map(r => 
    `${r.approach},${r.file},${(r.fileSize / 1024 / 1024).toFixed(2)},${r.duration.toFixed(2)},${r.throughput.toFixed(2)}`
  ),
].join("\n");

await Deno.writeTextFile("results/benchmark.csv", csv);
console.log("Results written to results/benchmark.csv");
