// Benchmarks comparing async generators vs TransformStream for transformations

import { enumerate } from "../mod.ts";

// Test data - large enough to see meaningful differences
const testData = Array.from({ length: 10000 }, (_, i) => i);

// Simple transformation: double each number
async function* doubleGenerator(items: AsyncIterable<number>) {
  for await (const item of items) {
    yield item * 2;
  }
}

const doubleTransformStream = new TransformStream<number, number>({
  transform(chunk, controller) {
    controller.enqueue(chunk * 2);
  }
});

// Complex transformation: batch items
async function* batchGenerator<T>(items: AsyncIterable<T>, size: number) {
  let batch: T[] = [];
  for await (const item of items) {
    batch.push(item);
    if (batch.length === size) {
      yield batch;
      batch = [];
    }
  }
  if (batch.length > 0) yield batch;
}

function createBatchTransformStream<T>(size: number) {
  let batch: T[] = [];
  
  return new TransformStream<T, T[]>({
    transform(chunk, controller) {
      batch.push(chunk);
      if (batch.length === size) {
        controller.enqueue([...batch]);
        batch = [];
      }
    },
    flush(controller) {
      if (batch.length > 0) {
        controller.enqueue(batch);
      }
    }
  });
}

Deno.bench("Simple transform - async generator", async () => {
  await enumerate(testData)
    .transform(doubleGenerator)
    .collect();
});

Deno.bench("Simple transform - TransformStream", async () => {
  await enumerate(testData)
    .transform(doubleTransformStream)
    .collect();
});

Deno.bench("Complex transform (batching) - async generator", async () => {
  await enumerate(testData)
    .transform(items => batchGenerator(items, 100))
    .collect();
});

Deno.bench("Complex transform (batching) - TransformStream", async () => {
  await enumerate(testData)
    .transform(createBatchTransformStream(100))
    .collect();
});

// JSON parsing benchmark - more realistic workload
const jsonLines = Array.from({ length: 1000 }, (_, i) => 
  JSON.stringify({ id: i, value: `item-${i}`, timestamp: Date.now() })
);

async function* parseJsonGenerator(lines: AsyncIterable<string>) {
  for await (const line of lines) {
    try {
      const obj = JSON.parse(line);
      if (obj.id !== undefined) {
        yield obj;
      }
    } catch {
      // Skip invalid JSON
    }
  }
}

const parseJsonTransformStream = new TransformStream<string, any>({
  transform(chunk, controller) {
    try {
      const obj = JSON.parse(chunk);
      if (obj.id !== undefined) {
        controller.enqueue(obj);
      }
    } catch {
      // Skip invalid JSON
    }
  }
});

Deno.bench("JSON parsing - async generator", async () => {
  await enumerate(jsonLines)
    .transform(parseJsonGenerator)
    .collect();
});

Deno.bench("JSON parsing - TransformStream", async () => {
  await enumerate(jsonLines)
    .transform(parseJsonTransformStream)
    .collect();
});
