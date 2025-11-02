# WritableIterable

`WritableIterable` is a fascinating utility that inverts the normal data flow: instead of pulling data from an iterable, you push data into it. It bridges the gap between push-based (callbacks, events) and pull-based (async iteration) programming models.

## The Problem It Solves

Imagine you have a callback-based API (like event emitters, WebSocket messages, or sensor data) and you want to process it with proc's pipeline operations. You can't easily convert callbacks to an AsyncIterable... until now.

## How It Works

`WritableIterable` is both:
- **Writable**: You can `.write()` items to it
- **AsyncIterable**: You can iterate over it with `for await`

It uses an internal queue to buffer items between the writer and reader, allowing them to operate at different speeds.

## Basic Usage

<!-- TESTED: tests/docs/writable-iterable.test.ts - "WritableIterable - basic write and read" -->
```typescript
import { WritableIterable, sleep } from "jsr:@j50n/proc@{{gitv}}";

const writable = new WritableIterable<number>();

// Write in background (simulating slow producer)
(async () => {
  await writable.write(1);
  await sleep(100);
  await writable.write(2);
  await sleep(100);
  await writable.write(3);
  await writable.close();
})();

// Read (items arrive as they're written)
const results: number[] = [];
for await (const item of writable) {
  console.log("Received:", item);
  results.push(item);
}

console.log(results); // [1, 2, 3]
```

This demonstrates the streaming nature: the reader receives items as they're written, not all at once.

> **⚠️ Important**: You MUST call `.close()` when done writing, or iteration will hang forever waiting for more data.

## Key Concepts

### Push vs Pull

**Traditional AsyncIterable (pull-based)**:
```typescript
// Consumer pulls data
for await (const item of iterable) {
  // Process item
}
```

**WritableIterable (push-based)**:
```typescript
// Producer pushes data
await writable.write(item);
```

### Backpressure

`WritableIterable` implements automatic backpressure. If the writer is faster than the reader, `.write()` will pause until the reader catches up. This prevents unbounded memory growth.

## Real-World Examples

### Example 1: Event Stream to Pipeline

Convert DOM events into a processable stream:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable, enumerate } from "jsr:@j50n/proc@{{gitv}}";

const clicks = new WritableIterable<MouseEvent>();

// Producer: capture clicks
document.addEventListener("click", async (event) => {
  await clicks.write(event);
});

// Consumer: process clicks
enumerate(clicks)
  .map(event => ({ x: event.clientX, y: event.clientY }))
  .filter(pos => pos.x > 100)
  .forEach(pos => console.log("Click at:", pos));

// Close when done (e.g., on page unload)
window.addEventListener("unload", () => clicks.close());
```

### Example 2: WebSocket to Process

Feed WebSocket messages to a process:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable } from "jsr:@j50n/proc@{{gitv}}";

const messages = new WritableIterable<string>();

// Producer: WebSocket messages
const ws = new WebSocket("wss://example.com");
ws.onmessage = async (event) => {
  await messages.write(event.data);
};
ws.onclose = () => messages.close();

// Consumer: pipe to process
await enumerate(messages)
  .run("jq", ".")  // Pretty-print JSON
  .toStdout();
```

### Example 3: Sensor Data Stream

Process sensor readings as they arrive:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable, enumerate } from "jsr:@j50n/proc@{{gitv}}";

interface SensorReading {
  temperature: number;
  timestamp: number;
}

const readings = new WritableIterable<SensorReading>();

// Producer: sensor callback
sensor.onReading(async (reading) => {
  await readings.write(reading);
});

// Consumer: calculate moving average
const averages = await enumerate(readings)
  .map(r => r.temperature)
  .take(100)  // First 100 readings
  .reduce((acc, temp) => acc + temp, 0)
  .then(sum => sum / 100);

console.log(`Average: ${averages}°C`);
await readings.close();
```

### Example 4: Manual Process stdin

Feed data to a process programmatically:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable, enumerate } from "jsr:@j50n/proc@{{gitv}}";

const input = new WritableIterable<string>();

// Producer: generate data
(async () => {
  for (let i = 0; i < 10; i++) {
    await input.write(`line ${i}`);
  }
  await input.close();
})();

// Consumer: pipe to process
await enumerate(input)
  .run("grep", "5")
  .toStdout();
// Output: line 5
```

## Error Handling

Errors propagate through the iteration:

<!-- TESTED: tests/docs/writable-iterable.test.ts - "WritableIterable - error propagation" -->
```typescript
import { WritableIterable } from "jsr:@j50n/proc@{{gitv}}";

const writable = new WritableIterable<number>();

// Write and close with error
(async () => {
  await writable.write(1);
  await writable.write(2);
  await writable.close(new Error("something failed"));
})();

try {
  for await (const item of writable) {
    console.log(item);
  }
} catch (error) {
  console.error("Error:", error.message);
}
// Output:
// 1
// 2
// Error: something failed
```

## Cleanup with onclose

You can provide a cleanup callback:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { WritableIterable } from "jsr:@j50n/proc@{{gitv}}";

const writable = new WritableIterable<string>({
  onclose: async () => {
    console.log("Cleaning up resources...");
    // Close connections, files, etc.
  }
});

await writable.write("data");
await writable.close();
// Output: Cleaning up resources...
```

## API Reference

### Constructor

```typescript
new WritableIterable<T>(options?: { onclose?: () => void | Promise<void> })
```

- `options.onclose`: Optional callback invoked when `.close()` is called

### Methods

**`.write(item: T): Promise<void>`**
- Write an item to the stream
- Throws if already closed
- Implements backpressure (pauses if reader is slow)

**`.close(error?: Error): Promise<void>`**
- Close the stream
- Must be called to end iteration
- Safe to call multiple times
- Optional error propagates to reader

### Properties

**`.isClosed: boolean`**
- Returns `true` if `.close()` has been called

## Common Patterns

### Pattern: Timed Data Generation

<!-- NOT TESTED: Illustrative example -->
```typescript
const timed = new WritableIterable<number>();

(async () => {
  for (let i = 0; i < 5; i++) {
    await timed.write(i);
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  await timed.close();
})();

for await (const item of timed) {
  console.log(item); // Prints 0, 1, 2, 3, 4 (one per second)
}
```

### Pattern: Conditional Close

<!-- NOT TESTED: Illustrative example -->
```typescript
const conditional = new WritableIterable<number>();

(async () => {
  for (let i = 0; i < 100; i++) {
    await conditional.write(i);
    if (i === 10) {
      await conditional.close(); // Stop early
      break;
    }
  }
})();

const items = await enumerate(conditional).collect();
console.log(items.length); // 11 (0 through 10)
```

## When to Use WritableIterable

**Use it when:**
- Converting callback-based APIs to AsyncIterable
- Feeding data to process stdin programmatically
- Bridging event-driven and stream-based code
- You need backpressure between producer and consumer

**Don't use it when:**
- You already have an AsyncIterable (use `enumerate()` instead)
- You're working with synchronous data (use arrays)
- You need multi-consumer support (WritableIterable is single-consumer)

## Performance Notes

- Internal queue grows if writer is faster than reader
- Backpressure prevents unbounded growth
- Each `.write()` creates a Promise (small overhead)
- Best for moderate data rates (not millions of items/second)

## Comparison with Other Approaches

### vs. Array

```typescript
// Array: all data in memory
const data = [1, 2, 3];
for (const item of data) { }

// WritableIterable: streaming, backpressure
const writable = new WritableIterable<number>();
for await (const item of writable) { }
```

### vs. TransformStream

```typescript
// TransformStream: byte-oriented, Web Streams API
const { readable, writable } = new TransformStream();

// WritableIterable: value-oriented, AsyncIterable
const writable = new WritableIterable<T>();
```

### vs. Channel (from other languages)

If you're familiar with Go channels or Rust channels, `WritableIterable` is similar but:
- Single-consumer (not multi-consumer)
- Unbuffered by default (backpressure on every write)
- Integrates with AsyncIterable ecosystem

## The "Interesting Little Beast"

What makes `WritableIterable` interesting:

1. **Inverted Control**: Most iterables pull data; this one receives pushes
2. **Backpressure**: Automatically slows down fast producers
3. **Bridge Pattern**: Connects imperative (callbacks) to declarative (iteration)
4. **Error Propagation**: Errors flow naturally through the iteration
5. **Simple API**: Just `.write()`, `.close()`, and iterate

It's a small utility that solves a specific problem elegantly: turning push-based data sources into pull-based async iterables that work seamlessly with proc's pipeline operations.
