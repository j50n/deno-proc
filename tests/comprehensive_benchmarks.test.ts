// Comprehensive benchmarks: async generators vs TransformStream
// Tests different scenarios, data sizes, and transformation complexities

import { enumerate } from "../mod.ts";

// Test data of different sizes
const small = Array.from({ length: 100 }, (_, i) => i);
const medium = Array.from({ length: 10000 }, (_, i) => i);
const large = Array.from({ length: 100000 }, (_, i) => i);

const jsonSmall = Array.from(
  { length: 100 },
  (_, i) => JSON.stringify({ id: i, name: `user-${i}`, active: i % 2 === 0 }),
);
const jsonMedium = Array.from(
  { length: 10000 },
  (_, i) => JSON.stringify({ id: i, name: `user-${i}`, active: i % 2 === 0 }),
);

// =============================================================================
// 1. SIMPLE TRANSFORMATIONS (1:1 mapping)
// =============================================================================

async function* doubleGen(items: AsyncIterable<number>) {
  for await (const item of items) {
    yield item * 2;
  }
}

const doubleStream = new TransformStream<number, number>({
  transform(chunk, controller) {
    controller.enqueue(chunk * 2);
  },
});

Deno.bench("Simple double - small (100) - generator", async () => {
  await enumerate(small).transform(doubleGen).collect();
});

Deno.bench("Simple double - small (100) - stream", async () => {
  await enumerate(small).transform(doubleStream).collect();
});

Deno.bench("Simple double - medium (10k) - generator", async () => {
  await enumerate(medium).transform(doubleGen).collect();
});

Deno.bench("Simple double - medium (10k) - stream", async () => {
  await enumerate(medium).transform(doubleStream).collect();
});

Deno.bench("Simple double - large (100k) - generator", async () => {
  await enumerate(large).transform(doubleGen).collect();
});

Deno.bench("Simple double - large (100k) - stream", async () => {
  await enumerate(large).transform(doubleStream).collect();
});

// =============================================================================
// 2. FILTERING TRANSFORMATIONS (1:0 or 1:1)
// =============================================================================

async function* filterEvenGen(items: AsyncIterable<number>) {
  for await (const item of items) {
    if (item % 2 === 0) {
      yield item;
    }
  }
}

const filterEvenStream = new TransformStream<number, number>({
  transform(chunk, controller) {
    if (chunk % 2 === 0) {
      controller.enqueue(chunk);
    }
  },
});

Deno.bench("Filter even - medium (10k) - generator", async () => {
  await enumerate(medium).transform(filterEvenGen).collect();
});

Deno.bench("Filter even - medium (10k) - stream", async () => {
  await enumerate(medium).transform(filterEvenStream).collect();
});

// =============================================================================
// 3. STATEFUL TRANSFORMATIONS
// =============================================================================

async function* runningTotalGen(items: AsyncIterable<number>) {
  let total = 0;
  for await (const item of items) {
    total += item;
    yield total;
  }
}

function createRunningTotalStream() {
  let total = 0;
  return new TransformStream<number, number>({
    transform(chunk, controller) {
      total += chunk;
      controller.enqueue(total);
    },
  });
}

Deno.bench("Running total - medium (10k) - generator", async () => {
  await enumerate(medium).transform(runningTotalGen).collect();
});

Deno.bench("Running total - medium (10k) - stream", async () => {
  await enumerate(medium).transform(createRunningTotalStream()).collect();
});

// =============================================================================
// 4. BATCHING (1:many to 1)
// =============================================================================

async function* batchGen<T>(items: AsyncIterable<T>, size: number) {
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

function createBatchStream<T>(size: number) {
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
    },
  });
}

Deno.bench("Batch (size 10) - medium (10k) - generator", async () => {
  await enumerate(medium).transform((items) => batchGen(items, 10)).collect();
});

Deno.bench("Batch (size 10) - medium (10k) - stream", async () => {
  await enumerate(medium).transform(createBatchStream(10)).collect();
});

Deno.bench("Batch (size 100) - medium (10k) - generator", async () => {
  await enumerate(medium).transform((items) => batchGen(items, 100)).collect();
});

Deno.bench("Batch (size 100) - medium (10k) - stream", async () => {
  await enumerate(medium).transform(createBatchStream(100)).collect();
});

// =============================================================================
// 5. JSON PARSING (realistic workload)
// =============================================================================

interface User {
  id: number;
  name: string;
  active: boolean;
}

async function* parseJsonGen(lines: AsyncIterable<string>) {
  for await (const line of lines) {
    try {
      const obj = JSON.parse(line) as User;
      if (obj.id !== undefined && obj.name) {
        yield obj;
      }
    } catch {
      // Skip invalid JSON
    }
  }
}

const parseJsonStream = new TransformStream<string, User>({
  transform(chunk, controller) {
    try {
      const obj = JSON.parse(chunk) as User;
      if (obj.id !== undefined && obj.name) {
        controller.enqueue(obj);
      }
    } catch {
      // Skip invalid JSON
    }
  },
});

Deno.bench("JSON parse - small (100) - generator", async () => {
  await enumerate(jsonSmall).transform(parseJsonGen).collect();
});

Deno.bench("JSON parse - small (100) - stream", async () => {
  await enumerate(jsonSmall).transform(parseJsonStream).collect();
});

Deno.bench("JSON parse - medium (10k) - generator", async () => {
  await enumerate(jsonMedium).transform(parseJsonGen).collect();
});

Deno.bench("JSON parse - medium (10k) - stream", async () => {
  await enumerate(jsonMedium).transform(parseJsonStream).collect();
});

// =============================================================================
// 6. COMPLEX MULTI-STAGE PROCESSING
// =============================================================================

async function* complexProcessingGen(items: AsyncIterable<number>) {
  let count = 0;
  let sum = 0;

  for await (const item of items) {
    // Stage 1: Filter
    if (item % 3 === 0) continue;

    // Stage 2: Transform
    const transformed = item * 2 + 1;

    // Stage 3: Accumulate state
    count++;
    sum += transformed;

    // Stage 4: Emit result with metadata
    yield {
      value: transformed,
      runningAvg: sum / count,
      count: count,
    };
  }
}

function createComplexProcessingStream() {
  let count = 0;
  let sum = 0;

  return new TransformStream<
    number,
    { value: number; runningAvg: number; count: number }
  >({
    transform(chunk, controller) {
      // Stage 1: Filter
      if (chunk % 3 === 0) return;

      // Stage 2: Transform
      const transformed = chunk * 2 + 1;

      // Stage 3: Accumulate state
      count++;
      sum += transformed;

      // Stage 4: Emit result with metadata
      controller.enqueue({
        value: transformed,
        runningAvg: sum / count,
        count: count,
      });
    },
  });
}

Deno.bench("Complex processing - medium (10k) - generator", async () => {
  await enumerate(medium).transform(complexProcessingGen).collect();
});

Deno.bench("Complex processing - medium (10k) - stream", async () => {
  await enumerate(medium).transform(createComplexProcessingStream()).collect();
});

// =============================================================================
// 7. ERROR HANDLING SCENARIOS
// =============================================================================

const mixedJsonData = [
  ...jsonSmall.slice(0, 50),
  "invalid json line 1",
  ...jsonSmall.slice(50, 80),
  "{ incomplete json",
  ...jsonSmall.slice(80),
  "another invalid line",
];

async function* parseWithErrorsGen(lines: AsyncIterable<string>) {
  let errorCount = 0;
  for await (const line of lines) {
    try {
      const obj = JSON.parse(line) as User;
      if (obj.id !== undefined) {
        yield { ...obj, errorCount };
      }
    } catch {
      errorCount++;
      // Continue processing
    }
  }
}

function createParseWithErrorsStream() {
  let errorCount = 0;
  return new TransformStream<string, User & { errorCount: number }>({
    transform(chunk, controller) {
      try {
        const obj = JSON.parse(chunk) as User;
        if (obj.id !== undefined) {
          controller.enqueue({ ...obj, errorCount });
        }
      } catch {
        errorCount++;
        // Continue processing
      }
    },
  });
}

Deno.bench("Parse with errors - generator", async () => {
  await enumerate(mixedJsonData).transform(parseWithErrorsGen).collect();
});

Deno.bench("Parse with errors - stream", async () => {
  await enumerate(mixedJsonData).transform(createParseWithErrorsStream())
    .collect();
});
