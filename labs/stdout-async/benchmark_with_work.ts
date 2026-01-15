#!/usr/bin/env -S deno run --allow-read --allow-run

const approaches = [
  { name: "sync_with_work", script: "sync_with_work.ts" },
  { name: "async_simple_with_work", script: "async_simple_with_work.ts" },
  { name: "async_queued_with_work", script: "async_queued_with_work.ts" },
];

const testFiles = [
  { name: "medium.txt", path: "data/medium.txt" },
  { name: "large.txt", path: "data/large.txt" },
];

async function runBenchmark(script: string, filePath: string): Promise<number> {
  const start = performance.now();
  const command = new Deno.Command("deno", {
    args: ["run", "--allow-read", script, filePath],
    stdout: "null",
    stderr: "inherit",
  });
  await command.output();
  return performance.now() - start;
}

console.log("Warmup...");
for (const approach of approaches) {
  await runBenchmark(approach.script, testFiles[0].path);
}

console.log("\nBenchmarking with CPU work...\n");

for (const file of testFiles) {
  const stat = await Deno.stat(file.path);
  const sizeMB = stat.size / 1024 / 1024;
  console.log(`${file.name} (${sizeMB.toFixed(0)} MB)`);
  
  for (const approach of approaches) {
    const duration = await runBenchmark(approach.script, file.path);
    const throughput = sizeMB / (duration / 1000);
    console.log(`  ${approach.name.padEnd(25)} ${duration.toFixed(2)}ms (${throughput.toFixed(2)} MB/s)`);
  }
  console.log();
}
