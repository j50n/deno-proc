# Processing Log Files

Analyze logs efficiently, even huge ones.

## Count Errors

<!-- TESTED: tests/mdbook_examples.test.ts - "log-processing: count errors" -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";

const errorCount = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .count();

console.log(`${errorCount} errors found`);
```

## Group by Error Type

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorTypes = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .reduce((acc, line) => {
    const match = line.match(/ERROR: (\w+)/);
    const type = match ? match[1] : "unknown";
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {});

console.log("Errors by type:");
Object.entries(errorTypes)
  .sort((a, b) => b[1] - a[1])
  .forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
```

## Extract Timestamps

<!-- NOT TESTED: Illustrative example -->
```typescript
const errors = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .map(line => {
    const timestamp = line.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)?.[0];
    const message = line.split("ERROR:")[1]?.trim();
    return { timestamp, message };
  })
  .collect();
```

## Find Patterns

<!-- NOT TESTED: Illustrative example -->
```typescript
const suspiciousIPs = await read("access.log")
  .lines
  .map(line => {
    const ip = line.match(/\d+\.\d+\.\d+\.\d+/)?.[0];
    const status = line.match(/HTTP\/\d\.\d" (\d+)/)?.[1];
    return { ip, status };
  })
  .filter(entry => entry.status === "404")
  .reduce((acc, entry) => {
    if (entry.ip) {
      acc[entry.ip] = (acc[entry.ip] || 0) + 1;
    }
    return acc;
  }, {});

// Show IPs with > 100 404s
Object.entries(suspiciousIPs)
  .filter(([_, count]) => count > 100)
  .forEach(([ip, count]) => {
    console.log(`${ip}: ${count} 404s`);
  });
```

## Time-Based Analysis

<!-- NOT TESTED: Illustrative example -->
```typescript
const errorsByHour = await read("app.log")
  .lines
  .filter(line => line.includes("ERROR"))
  .reduce((acc, line) => {
    const hour = line.match(/T(\d{2}):/)?.[1];
    if (hour) {
      acc[hour] = (acc[hour] || 0) + 1;
    }
    return acc;
  }, {});

console.log("Errors by hour:");
Object.entries(errorsByHour)
  .sort((a, b) => a[0].localeCompare(b[0]))
  .forEach(([hour, count]) => {
    console.log(`${hour}:00 - ${count} errors`);
  });
```

## Multiple Log Files

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate } from "jsr:@j50n/proc@{{gitv}}";

const files = ["app1.log", "app2.log", "app3.log"];

const results = await enumerate(files)
  .concurrentMap(async (file) => {
    const errors = await read(file)
      .lines
      .filter(line => line.includes("ERROR"))
      .count();
    return { file, errors };
  }, { concurrency: 3 })
  .collect();

results.forEach(({ file, errors }) => {
  console.log(`${file}: ${errors} errors`);
});
```

## Compressed Logs

<!-- NOT TESTED: Illustrative example -->
```typescript
const errors = await read("app.log.gz")
  .transform(new DecompressionStream("gzip"))
  .lines
  .filter(line => line.includes("ERROR"))
  .take(10)
  .collect();
```

## Real-Time Monitoring

<!-- NOT TESTED: Illustrative example -->
```typescript
// Process log as it grows
for await (const line of read("app.log").lines) {
  if (line.includes("ERROR")) {
    console.error(`🔴 ${line}`);
  } else if (line.includes("WARN")) {
    console.warn(`⚠️  ${line}`);
  }
}
```

## Next Steps

- [Streaming Large Files](../advanced/streaming.md) - Handle huge logs
- [Concurrent Processing](../advanced/concurrent.md) - Process multiple files
- [Decompressing Files](./decompression.md) - Work with compressed logs
