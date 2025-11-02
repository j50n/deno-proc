# Sleep

The `sleep` function pauses execution for a specified duration. While it might seem like an outlier in a process management library, it's surprisingly useful when working with async pipelines, rate limiting, and testing.

## Basic Usage

<!-- NOT TESTED: Illustrative example -->
```typescript
import { sleep } from "jsr:@j50n/proc@{{gitv}}";

console.log("Starting...");
await sleep(2000);  // Pause for 2 seconds
console.log("Done!");
```

## Why It's Included

When working with processes and async iterables, you often need to:
- Rate limit operations
- Add delays between retries
- Simulate slow data sources for testing
- Throttle concurrent operations
- Add breathing room for external services

Having `sleep` built-in means you don't need to import it from another library or write the `setTimeout` wrapper yourself.

## Common Use Cases

### Rate Limiting API Calls

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate, sleep } from "jsr:@j50n/proc@{{gitv}}";

const urls = ["url1", "url2", "url3"];

await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    await sleep(1000);  // Wait 1 second between requests
    return response.json();
  }, { concurrency: 1 })
  .forEach(data => console.log(data));
```

### Retry with Backoff

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run, sleep } from "jsr:@j50n/proc@{{gitv}}";

async function runWithRetry(maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await run("flaky-command").lines.collect();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.pow(2, i) * 1000;  // Exponential backoff
      console.log(`Retry ${i + 1} after ${delay}ms...`);
      await sleep(delay);
    }
  }
}
```

### Simulating Slow Data Sources

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable, sleep } from "jsr:@j50n/proc@{{gitv}}";

const slowData = new WritableIterable<number>();

// Simulate data arriving slowly
(async () => {
  for (let i = 0; i < 10; i++) {
    await slowData.write(i);
    await sleep(500);  // 500ms between items
  }
  await slowData.close();
})();

for await (const item of slowData) {
  console.log("Received:", item);
}
```

### Throttling Process Output

<!-- NOT TESTED: Illustrative example -->
```typescript
import { run, sleep } from "jsr:@j50n/proc@{{gitv}}";

// Process lines slowly to avoid overwhelming downstream
await run("cat", "large-file.txt")
  .lines
  .map(async (line) => {
    await sleep(10);  // 10ms delay per line
    return line;
  })
  .toStdout();
```

### Testing Concurrent Operations

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate, sleep } from "jsr:@j50n/proc@{{gitv}}";

// Verify concurrency limit works correctly
const startTimes: number[] = [];

await enumerate([1, 2, 3, 4, 5])
  .concurrentMap(async (n) => {
    startTimes.push(Date.now());
    await sleep(100);  // Simulate work
    return n;
  }, { concurrency: 2 })
  .collect();

// Analyze timing to verify only 2 ran concurrently
```

## Time Constants

The library also provides time constants for readability:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { sleep, SECONDS, MINUTES } from "jsr:@j50n/proc@{{gitv}}";

await sleep(5 * SECONDS);   // 5 seconds
await sleep(2 * MINUTES);   // 2 minutes
```

Available constants:
- `SECONDS` = 1000 milliseconds
- `MINUTES` = 60 seconds
- `HOURS` = 60 minutes
- `DAYS` = 24 hours
- `WEEKS` = 7 days

## API

```typescript
function sleep(delayms: number): Promise<void>
```

**Parameters:**
- `delayms`: Delay in milliseconds

**Returns:**
- Promise that resolves after the specified delay

## Notes

- Uses `setTimeout` internally
- Non-blocking (other async operations can run)
- Minimum delay depends on JavaScript runtime (typically ~4ms)
- For precise timing, consider using `performance.now()` to measure actual elapsed time
