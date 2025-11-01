# Parallel Downloads

Download multiple files concurrently with controlled concurrency.

## Basic Example

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const urls = [
  "https://example.com/file1.json",
  "https://example.com/file2.json",
  "https://example.com/file3.json",
  // ... more URLs
];

const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return {
      url,
      data: await response.json(),
      size: response.headers.get("content-length")
    };
  }, { concurrency: 5 })
  .collect();

console.log(`Downloaded ${results.length} files`);
```

## Download and Save Files

Download files and save them to disk:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const downloads = [
  { url: "https://example.com/image1.jpg", path: "./downloads/image1.jpg" },
  { url: "https://example.com/image2.jpg", path: "./downloads/image2.jpg" },
  { url: "https://example.com/image3.jpg", path: "./downloads/image3.jpg" },
];

await enumerate(downloads)
  .concurrentMap(async ({ url, path }) => {
    const response = await fetch(url);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    await Deno.writeFile(path, new Uint8Array(buffer));
    console.log(`Downloaded: ${path}`);
    return path;
  }, { concurrency: 3 })
  .collect();

console.log("All downloads complete");
```

## With Progress Tracking

Track download progress:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

let completed = 0;
const total = urls.length;

const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetch(url);
    const data = await response.json();
    
    completed++;
    console.log(`Progress: ${completed}/${total} (${Math.round(completed/total*100)}%)`);
    
    return { url, data };
  }, { concurrency: 5 })
  .collect();
```

## With Retry Logic

Retry failed downloads:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
      
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${response.status}`);
      }
    } catch (error) {
      if (attempt === maxRetries) throw error;
      
      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      console.log(`Retry ${attempt}/${maxRetries} for ${url} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error("Unreachable");
}

const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    const response = await fetchWithRetry(url);
    return await response.json();
  }, { concurrency: 5 })
  .collect();
```

## Download Large Files

Stream large files to disk without loading into memory:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const largeFiles = [
  { url: "https://example.com/large1.zip", path: "./large1.zip" },
  { url: "https://example.com/large2.zip", path: "./large2.zip" },
];

await enumerate(largeFiles)
  .concurrentMap(async ({ url, path }) => {
    const response = await fetch(url);
    if (!response.body) throw new Error("No response body");
    
    const file = await Deno.open(path, { write: true, create: true });
    await response.body.pipeTo(file.writable);
    
    console.log(`Downloaded: ${path}`);
    return path;
  }, { concurrency: 2 })
  .collect();
```

## API Rate Limiting

Respect API rate limits:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const apiEndpoints = [
  "/api/users/1",
  "/api/users/2",
  // ... 100 more
];

// Add delay between requests
await enumerate(apiEndpoints)
  .concurrentMap(async (endpoint) => {
    const response = await fetch(`https://api.example.com${endpoint}`);
    const data = await response.json();
    
    // Wait 100ms between requests (10 requests/second)
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return data;
  }, { concurrency: 1 })  // Sequential to respect rate limit
  .collect();
```

## Filter Failed Downloads

Continue even if some downloads fail:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const results = await enumerate(urls)
  .concurrentMap(async (url) => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      return { url, data: await response.json() };
    } catch (error) {
      console.error(`Failed to download ${url}:`, error.message);
      return null;
    }
  }, { concurrency: 5 })
  .filter(result => result !== null)
  .collect();

console.log(`Successfully downloaded ${results.length}/${urls.length} files`);
```

## When to Use

**Use parallel downloads when:**
- You have multiple independent files to fetch
- Network latency is the bottleneck
- The server can handle concurrent requests
- You want to minimize total download time

**Choose concurrency based on:**
- Server rate limits (respect them!)
- Your network bandwidth
- Server capacity
- Start with 3-5, adjust based on results

## Next Steps

- [Concurrent Processing](../advanced/concurrent.md) - Deep dive into concurrency
- [Error Handling](../core/error-handling.md) - Handle download failures
- [Streaming Large Files](../advanced/streaming.md) - Work with large downloads
