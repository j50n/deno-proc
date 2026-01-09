#!/usr/bin/env -S deno run --allow-all

/**
 * Benchmark runner for all implementations
 */

import { run } from "@j50n/proc";

interface BenchmarkResult {
  implementation: string;
  format: 'csv' | 'tsv';
  columns: number;
  rowsProcessed: number;
  durationMs: number;
  memoryPeakMB: number;
  throughputRowsPerSec: number;
  throughputMBPerSec: number;
}

const IMPLEMENTATIONS = [
  'baseline-js',
  'worker-js', 
  'process-ts',
  'process-native',
  'wasm-direct',
  'wasm-threaded'
];

const DATASETS = [
  { format: 'csv' as const, columns: 10 },
  { format: 'csv' as const, columns: 100 },
  { format: 'csv' as const, columns: 1000 },
  { format: 'tsv' as const, columns: 10 },
  { format: 'tsv' as const, columns: 100 },
  { format: 'tsv' as const, columns: 1000 }
];

async function runBenchmark(impl: string, dataset: typeof DATASETS[0]): Promise<BenchmarkResult | null> {
  const implPath = `implementations/${impl}`;
  const dataPath = `data/${dataset.format}/data_${dataset.columns}cols.${dataset.format}`;
  
  try {
    console.log(`Running ${impl} on ${dataset.format}/${dataset.columns} cols...`);
    
    const result = await run("deno", "run", "--allow-all", "--cpu-prof", 
      `${implPath}/benchmark.ts`, dataPath, dataset.format)
      .lines.first;
    
    if (!result) throw new Error("No benchmark result");
    
    return JSON.parse(result);
  } catch (error) {
    console.error(`❌ ${impl} failed:`, error.message);
    return null;
  }
}

async function main() {
  const results: BenchmarkResult[] = [];
  
  console.log('Starting benchmark suite...\n');
  
  for (const impl of IMPLEMENTATIONS) {
    console.log(`\n=== ${impl.toUpperCase()} ===`);
    
    for (const dataset of DATASETS) {
      const result = await runBenchmark(impl, dataset);
      if (result) {
        results.push(result);
        console.log(`✓ ${result.throughputRowsPerSec.toFixed(0)} rows/sec, ${result.throughputMBPerSec.toFixed(1)} MB/sec`);
      }
    }
  }
  
  // Save results
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const resultsFile = `benchmark/results/results-${timestamp}.json`;
  
  await Deno.mkdir('benchmark/results', { recursive: true });
  await Deno.writeTextFile(resultsFile, JSON.stringify(results, null, 2));
  
  console.log(`\n✓ Results saved to ${resultsFile}`);
  console.log(`\nRun analysis: deno run analysis/compare.ts ${resultsFile}`);
}

if (import.meta.main) {
  main().catch(console.error);
}
