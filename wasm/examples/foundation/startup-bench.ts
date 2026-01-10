/**
 * Microbenchmark: WASM instance startup overhead
 *
 * Measures how long it takes to create a new WASM instance,
 * call one function, and dispose of it.
 */

import { MathDemo } from "./math-demo.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const WARMUP = 10_000;
const ITERATIONS = 100_000;

console.log(`Warming up with ${WARMUP.toLocaleString()} iterations...`);
for (let i = 0; i < WARMUP; i++) {
  const demo = await MathDemo.create();
  demo.fibonacci(10);
}

console.log("Sleeping 5 seconds to let JIT settle...");
await sleep(5000);

console.log(`Running ${ITERATIONS.toLocaleString()} measured iterations...`);
const times: number[] = [];

for (let i = 0; i < ITERATIONS; i++) {
  const start = performance.now();

  const demo = await MathDemo.create();
  demo.fibonacci(10);

  times.push(performance.now() - start);
}

const avg = times.reduce((a, b) => a + b, 0) / times.length;
const min = Math.min(...times);
const max = Math.max(...times);
const sorted = [...times].sort((a, b) => a - b);
const p50 = sorted[Math.floor(times.length * 0.5)];
const p95 = sorted[Math.floor(times.length * 0.95)];
const p99 = sorted[Math.floor(times.length * 0.99)];

console.log(
  `\nWASM Instance Startup Benchmark (${ITERATIONS.toLocaleString()} iterations)`,
);
console.log("─".repeat(50));
console.log(`Average: ${avg.toFixed(3)} ms`);
console.log(`Min:     ${min.toFixed(3)} ms`);
console.log(`Max:     ${max.toFixed(3)} ms`);
console.log(`P50:     ${p50.toFixed(3)} ms`);
console.log(`P95:     ${p95.toFixed(3)} ms`);
console.log(`P99:     ${p99.toFixed(3)} ms`);
