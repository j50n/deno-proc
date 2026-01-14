#!/usr/bin/env -S deno run --allow-read

import { OdinRuntime } from "./odin-runtime.ts";

const WARMUP = 10000;
const ITERATIONS = 100000;

async function loadWasm(): Promise<WebAssembly.Instance> {
  const bytes = await Deno.readFile(new URL("add.wasm", import.meta.url));
  const module = await WebAssembly.compile(bytes);
  const memory = new WebAssembly.Memory({ initial: 1 });
  return await WebAssembly.instantiate(module, {
    odin_env: new OdinRuntime(memory).createEnv(),
  });
}

// Warmup
console.log(`Warming up (${WARMUP} iterations)...`);
for (let i = 0; i < WARMUP; i++) {
  await loadWasm();
}

// Sleep
console.log("Sleeping 3 seconds...");
await new Promise((r) => setTimeout(r, 3000));

// Measure
console.log(`Measuring (${ITERATIONS} iterations)...`);
const times: number[] = [];
for (let i = 0; i < ITERATIONS; i++) {
  const start = performance.now();
  const instance = await loadWasm();
  const add = instance.exports.add as (a: number, b: number) => number;
  add(2, 3);
  times.push(performance.now() - start);
}

times.sort((a, b) => a - b);
const avg = times.reduce((a, b) => a + b) / times.length;
const p50 = times[Math.floor(times.length * 0.5)];
const p99 = times[Math.floor(times.length * 0.99)];

console.log(`\nStartup Benchmark (${ITERATIONS} iterations)`);
console.log(`  Avg: ${avg.toFixed(3)}ms`);
console.log(`  P50: ${p50.toFixed(3)}ms`);
console.log(`  P99: ${p99.toFixed(3)}ms`);
console.log(`  Min: ${times[0].toFixed(3)}ms`);
console.log(`  Max: ${times[times.length - 1].toFixed(3)}ms`);
