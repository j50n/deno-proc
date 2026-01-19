#!/usr/bin/env -S deno run --allow-read --allow-run
/**
 * Benchmark: CSV to TSV conversion
 * Compares flatdata (WASM) vs Deno's built-in CSV parser + JS conversion
 */

import { parseArgs } from "jsr:@std/cli/parse-args";

async function benchmarkFlatdata(inputPath: string): Promise<number> {
  const start = performance.now();
  
  const proc = new Deno.Command("bash", {
    args: ["-c", `cat ${inputPath} | deno run --allow-read scripts/flatdata/flatdata.ts csv2tsv`],
    stdout: "piped",
    stderr: "inherit",
  }).spawn();
  
  let bytes = 0;
  for await (const chunk of proc.stdout) {
    bytes += chunk.length;
  }
  
  await proc.status;
  const elapsed = performance.now() - start;
  
  return bytes / (elapsed / 1000) / (1024 * 1024);
}

async function benchmarkDenoCSV(inputPath: string): Promise<number> {
  const start = performance.now();
  
  const file = await Deno.open(inputPath);
  const text = await new Response(file.readable).text();
  
  // Parse CSV using Deno's RFC 4180 parser
  const { parse } = await import("jsr:@std/csv");
  const rows = parse(text);
  
  // Convert to TSV
  const encoder = new TextEncoder();
  let bytes = 0;
  for (const row of rows) {
    const tsv = Object.values(row).join('\t') + '\n';
    bytes += encoder.encode(tsv).length;
  }
  
  const elapsed = performance.now() - start;
  return bytes / (elapsed / 1000) / (1024 * 1024);
}

async function main() {
  const args = parseArgs(Deno.args, {
    string: ["input"],
    default: { input: "/tmp/test_large.csv" },
  });

  const inputPath = args.input;
  
  console.log(`Benchmarking CSV→TSV conversion`);
  console.log(`Input: ${inputPath}`);
  console.log();

  // Get file size
  const stat = await Deno.stat(inputPath);
  const sizeMB = stat.size / (1024 * 1024);
  console.log(`File size: ${sizeMB.toFixed(2)} MB`);
  console.log();

  // Benchmark Deno CSV
  console.log("Benchmarking Deno CSV parser + JS conversion...");
  const runs = 3;
  const denoResults: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const mbps = await benchmarkDenoCSV(inputPath);
    denoResults.push(mbps);
    console.log(`  Run ${i + 1}: ${mbps.toFixed(2)} MB/s`);
  }
  
  const denoAvg = denoResults.reduce((a, b) => a + b) / runs;
  const denoBest = Math.max(...denoResults);
  
  console.log();
  console.log("Benchmarking flatdata (WASM)...");
  const flatdataResults: number[] = [];
  
  for (let i = 0; i < runs; i++) {
    const mbps = await benchmarkFlatdata(inputPath);
    flatdataResults.push(mbps);
    console.log(`  Run ${i + 1}: ${mbps.toFixed(2)} MB/s`);
  }
  
  const flatdataAvg = flatdataResults.reduce((a, b) => a + b) / runs;
  const flatdataBest = Math.max(...flatdataResults);
  
  console.log();
  console.log("=".repeat(60));
  console.log("Results:");
  console.log("=".repeat(60));
  console.log(`Deno CSV:  ${denoAvg.toFixed(2)} MB/s avg, ${denoBest.toFixed(2)} MB/s best`);
  console.log(`flatdata:  ${flatdataAvg.toFixed(2)} MB/s avg, ${flatdataBest.toFixed(2)} MB/s best`);
  console.log();
  console.log(`Speedup: ${(flatdataAvg / denoAvg).toFixed(2)}x (avg), ${(flatdataBest / denoBest).toFixed(2)}x (best)`);
}

main();
