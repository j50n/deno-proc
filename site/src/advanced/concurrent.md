# Concurrent Processing

Process multiple items in parallel with controlled concurrency. It's easier than you think.

## The Problem

You have a list of URLs to fetch. Sequential is slow:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Takes 10 seconds for 10 URLs (1 second each)
for (const url of urls) {
  await fetch(url);
}
```

Promise.all is fast but dangerous:

<!-- NOT TESTED: Illustrative example -->
```typescript
// Starts 1000 requests at once - might crash
await Promise.all(urls.map(url => fetch(url)));
```

## The Solution

proc gives you controlled concurrency:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

// Defaults to CPU count (usually 4-8)
const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    return await fetch(url);
  })
  .collect();

// Or specify a limit
const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    return await fetch(url);
  }, { concurrency: 5 })
  .collect();
```

Fast, but won't overwhelm your system.

## When to Use Concurrent Processing

**Use `concurrentUnorderedMap()` (recommended default) when:**
- Order doesn't matter - you want maximum speed
- Processing independent tasks where results can arrive in any order
- You'll sort or aggregate results anyway
- **This is usually what you want** - it keeps all workers busy and delivers results as they complete
- Example: Downloading files, processing logs, fetching data you'll aggregate

**Use `concurrentMap()` when:**
- You **must** have results in the same order as input
- Be aware: can bottleneck on the slowest item in each batch
- If work isn't balanced, faster items wait for slower ones
- Example: Fetching user profiles where display order must match input order

**Use sequential processing when:**
- Tasks depend on each other
- You must respect strict rate limits
- Order is critical and tasks are fast
- Example: Database transactions that must happen in sequence

**Choose concurrency level based on:**
- **I/O-bound tasks** (network, disk): Start with 5-10, increase if you have bandwidth
- **CPU-bound tasks**: Use `navigator.hardwareConcurrency` (typically 4-8)
- **Rate-limited APIs**: Match the rate limit (e.g., 10 requests/second = concurrency 1 with 100ms delays)
- **Memory constraints**: Lower concurrency if processing large data per task

## concurrentUnorderedMap() - Recommended

Process items concurrently, return results as they complete (fastest):

<!-- NOT TESTED: Illustrative example -->
```typescript
// Defaults to CPU count
const results = await enumerate([1, 2, 3, 4, 5])
  .concurrentUnorderedMap(async (n) => {
    await sleep(Math.random() * 1000);
    return n * 2;
  })
  .collect();
// [6, 2, 10, 4, 8] - order varies, but all workers stay busy
```

**Why it's faster:** Results are delivered as soon as they're ready. If item 3 finishes before item 1, you get item 3 immediately. No waiting for slower items.

**Use when:** You don't care about order (most cases). Better performance under real-world conditions where work isn't perfectly balanced.

**Concurrency:** Defaults to `navigator.hardwareConcurrency` (CPU count). Override with `{ concurrency: n }` if needed.

## concurrentMap() - Order Preserved

Process items concurrently, return results in input order:

<!-- TESTED: tests/mdbook_examples.test.ts - "concurrent: concurrentMap" -->
```typescript
const results = await enumerate([1, 2, 3, 4, 5])
  .concurrentMap(async (n) => {
    await sleep(Math.random() * 1000);
    return n * 2;
  }, { concurrency: 3 })
  .collect();
// [2, 4, 6, 8, 10] - always in order
```

**Performance caveat:** If item 1 takes 5 seconds and item 2 takes 1 second, item 2 waits for item 1 before being returned. This can create bottlenecks where fast items wait for slow ones.

**Use when:** You specifically need results in the same order as input. Only use if order truly matters for your use case.

**Concurrency:** Defaults to CPU count. Override with `{ concurrency: n }` if needed.

## Real-World Examples

### Fetch Multiple URLs

<!-- NOT TESTED: Illustrative example -->
```typescript
const urls = [
  "https://api.example.com/1",
  "https://api.example.com/2",
  "https://api.example.com/3",
  // ... 100 more
];

// Uses CPU count by default
const data = await enumerate(urls)
  .concurrentUnorderedMap(async (url) => {
    const response = await fetch(url);
    return response.json();
  })
  .collect();

// Or limit for rate-limited APIs
const data = await enumerate(urls)
  .concurrentUnorderedMap(async (url) => {
    const response = await fetch(url);
    return response.json();
  }, { concurrency: 10 })
  .collect();
```

### Process Files in Parallel

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const files = ["log1.txt", "log2.txt", "log3.txt"];

const results = await enumerate(files)
  .concurrentMap(async (file) => {
    const errors = await read(file)
      .lines
      .filter(line => line.includes("ERROR"))
      .count();
    return { file, errors };
  })
  .collect();
```

### Download and Process

<!-- NOT TESTED: Illustrative example -->
```typescript
const downloads = await enumerate(imageUrls)
  .concurrentUnorderedMap(async (url) => {
    const response = await fetch(url);
    const blob = await response.blob();
    return processImage(blob);
  })
  .collect();
```

## Choosing Concurrency

**Default behavior:** Both methods default to `navigator.hardwareConcurrency` (CPU count, typically 4-8). This is usually a good starting point.

**When to override:**

**For I/O-bound tasks** (network, disk):
- Default is often fine
- Increase to 10-20 if you have bandwidth and no rate limits
- Decrease to 1-5 for rate-limited APIs

**For CPU-bound tasks**:
- Default (CPU count) is optimal
- Don't increase - you'll just add overhead

**For rate-limited APIs**:
- Set to match the rate limit
- Add delays if needed

<!-- NOT TESTED: Illustrative example -->
```typescript
// Respect rate limits with low concurrency
const results = await enumerate(apiCalls)
  .concurrentUnorderedMap(async (call) => {
    const result = await makeApiCall(call);
    await sleep(100); // 10 requests per second
    return result;
  }, { concurrency: 1 })
  .collect();
```

## Error Handling

Errors propagate naturally:

<!-- NOT TESTED: Illustrative example -->
```typescript
try {
  const results = await enumerate(urls)
    .concurrentMap(async (url) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed: ${url}`);
      }
      return response.json();
    }, { concurrency: 5 })
    .collect();
} catch (error) {
  // First error stops everything
  console.error(`Failed: ${error.message}`);
}
```

## Progress Tracking

Track progress as items complete:

<!-- NOT TESTED: Illustrative example -->
```typescript
let completed = 0;
const total = urls.length;

const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    const result = await fetch(url);
    completed++;
    console.log(`Progress: ${completed}/${total}`);
    return result;
  }, { concurrency: 5 })
  .collect();
```

## Combining with Other Operations

Chain concurrent operations with other methods:

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 })
  .filter(response => response.ok)
  .concurrentMap(response => response.json(), { concurrency: 5 })
  .filter(data => data.active)
  .collect();
```

## Performance Comparison

<!-- NOT TESTED: Illustrative example -->
```typescript
// Sequential: 10 seconds (one at a time)
for (const url of urls) {
  await fetch(url);
}

// concurrentMap (5): 2-4 seconds
// Can bottleneck if one item is slow - others wait
await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 })
  .collect();

// concurrentUnorderedMap (5): 2 seconds
// Faster - no waiting, results delivered as ready
await enumerate(urls)
  .concurrentUnorderedMap(fetch, { concurrency: 5 })
  .collect();
```

**Why unordered is faster:** Imagine 5 tasks with times [1s, 1s, 1s, 1s, 5s]. With `concurrentMap`, the 5-second task blocks its batch. With `concurrentUnorderedMap`, the four 1-second tasks complete and return immediately while the 5-second task finishes in the background.

## Advanced Patterns

### Batch Processing

Process in batches:

<!-- NOT TESTED: Illustrative example -->
```typescript
const batchSize = 10;
for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const results = await enumerate(batch)
    .concurrentMap(process, { concurrency: 5 })
    .collect();
  await saveBatch(results);
}
```

### Retry Failed Items

<!-- NOT TESTED: Illustrative example -->
```typescript
const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    let attempts = 0;
    while (attempts < 3) {
      try {
        return await fetch(url);
      } catch (error) {
        attempts++;
        if (attempts === 3) throw error;
        await sleep(1000 * attempts);
      }
    }
  }, { concurrency: 5 })
  .collect();
```

### Dynamic Concurrency

Adjust concurrency based on results:

<!-- NOT TESTED: Illustrative example -->
```typescript
let concurrency = 5;

for (const batch of batches) {
  const start = Date.now();
  
  const results = await enumerate(batch)
    .concurrentMap(process, { concurrency })
    .collect();
  
  const duration = Date.now() - start;
  
  // Adjust based on performance
  if (duration < 1000) concurrency = Math.min(concurrency + 1, 20);
  if (duration > 5000) concurrency = Math.max(concurrency - 1, 1);
}
```

## Best Practices

1. **Prefer unordered** - Use `concurrentUnorderedMap` unless you specifically need order
2. **Start conservative** - Begin with low concurrency, increase if needed
3. **Monitor resources** - Watch memory and network usage
4. **Respect rate limits** - Don't overwhelm external services
5. **Handle errors** - One error stops everything, handle gracefully
6. **Understand the bottleneck** - `concurrentMap` can wait on slow items; unordered doesn't

## Common Mistakes

### Too Much Concurrency

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Might crash with 10,000 concurrent requests
await enumerate(hugeList)
  .concurrentMap(fetch, { concurrency: 10000 })
  .collect();

// ✅ Reasonable concurrency
await enumerate(hugeList)
  .concurrentMap(fetch, { concurrency: 10 })
  .collect();
```

### Forgetting to Await

<!-- NOT TESTED: Illustrative example -->
```typescript
// ❌ Returns promises, not results
const promises = enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 });

// ✅ Await the results
const results = await enumerate(urls)
  .concurrentMap(fetch, { concurrency: 5 })
  .collect();
```

## Next Steps

- [Streaming Large Files](./streaming.md) - Handle huge files efficiently
- [Performance Optimization](./performance.md) - Make it faster
- [Parallel Downloads](../recipes/parallel-downloads.md) - Real-world example
