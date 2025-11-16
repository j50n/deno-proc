// Focused benchmarks to isolate overhead sources

import { enumerate } from "../mod.ts";

const testData = Array.from({ length: 10000 }, (_, i) => i);

// Raw async generator (no library wrapper)
async function* rawDoubleGenerator(items: number[]) {
  for (const item of items) {
    yield item * 2;
  }
}

// Async generator with AsyncIterable input (like library uses)
async function* asyncDoubleGenerator(items: AsyncIterable<number>) {
  for await (const item of items) {
    yield item * 2;
  }
}

// TransformStream
const doubleStream = new TransformStream<number, number>({
  transform(chunk, controller) {
    controller.enqueue(chunk * 2);
  },
});

// Test different approaches
Deno.bench("Raw generator (sync iteration)", async () => {
  const results = [];
  for await (const item of rawDoubleGenerator(testData)) {
    results.push(item);
  }
});

Deno.bench("Async generator (async iteration)", async () => {
  const results = [];
  for await (const item of asyncDoubleGenerator(enumerate(testData))) {
    results.push(item);
  }
});

Deno.bench("Library: enumerate + transform + collect", async () => {
  await enumerate(testData)
    .transform(asyncDoubleGenerator)
    .collect();
});

Deno.bench("Library: enumerate + map + collect", async () => {
  await enumerate(testData)
    .map((x) => x * 2)
    .collect();
});

Deno.bench("TransformStream via library", async () => {
  await enumerate(testData)
    .transform(doubleStream)
    .collect();
});

Deno.bench("Raw ReadableStream.from + pipeThrough", async () => {
  const results = [];
  for await (
    const item of ReadableStream.from(testData).pipeThrough(doubleStream)
  ) {
    results.push(item);
  }
});

// Test the enumerate overhead
Deno.bench("Just enumerate + collect (no transform)", async () => {
  await enumerate(testData).collect();
});

Deno.bench("Raw array iteration", () => {
  const results = [];
  for (const item of testData) {
    results.push(item);
  }
});
