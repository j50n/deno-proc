// Tests for key runnable examples from mdbook documentation
// These are examples users are likely to copy-paste

import { assert, assertEquals } from "@std/assert";
import { enumerate, range, read, run, sleep } from "../mod.ts";

// ===== Getting Started Examples =====

Deno.test("quick-start: basic run and capture", async () => {
  const lines = await run("echo", "Hello, proc!").lines.collect();
  assertEquals(lines, ["Hello, proc!"]);
});

Deno.test("quick-start: chain processes", async () => {
  const result = await run("echo", "HELLO WORLD")
    .run("tr", "A-Z", "a-z")
    .lines.first;
  assertEquals(result, "hello world");
});

Deno.test("quick-start: process file", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(
    tempFile,
    "line1\nERROR: test\nline3\nERROR: another\n",
  );

  try {
    const errorCount = await read(tempFile)
      .lines
      .filter((line) => line.includes("ERROR"))
      .count();
    assertEquals(errorCount, 2);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("quick-start: handle errors", async () => {
  try {
    await run("false").lines.collect();
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals((error as { code: number }).code, 1);
  }
});

Deno.test("quick-start: enumerate with indices", async () => {
  const data = ["apple", "banana", "cherry"];
  const numbered = await enumerate(data)
    .enum()
    .map(([fruit, i]) => `${i + 1}. ${fruit}`)
    .collect();
  assertEquals(numbered, ["1. apple", "2. banana", "3. cherry"]);
});

Deno.test("quick-start: git log example", async () => {
  const commits = await run(
    "echo",
    "abc123 fix: bug\ndef456 feat: new\nghi789 fix: another",
  )
    .lines
    .filter((line) => line.includes("fix"))
    .take(5)
    .collect();
  assertEquals(commits.length, 2);
});

// ===== Key Concepts Examples =====

Deno.test("key-concepts: enumerate without indices", async () => {
  const doubled = await enumerate([1, 2, 3])
    .map((n) => n * 2)
    .collect();
  assertEquals(doubled, [2, 4, 6]);
});

Deno.test("key-concepts: streaming", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "line1\nline2\nline3\n");

  try {
    const lines: string[] = [];
    for await (const line of read(tempFile).lines) {
      lines.push(line);
    }
    assertEquals(lines.length, 3);
  } finally {
    await Deno.remove(tempFile);
  }
});

// ===== Core Features Examples =====

Deno.test("running-processes: capture output", async () => {
  const lines = await run("ls", "-la").lines.collect();
  assertEquals(Array.isArray(lines), true);
});

Deno.test("running-processes: first line", async () => {
  const first = await run("echo", "test").lines.first;
  assertEquals(first, "test");
});

Deno.test("pipelines: chain commands", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "line1\nerror here\nline3\n");

  try {
    const result = await run("cat", tempFile)
      .run("grep", "error")
      .lines.first;
    assertEquals(result?.includes("error"), true);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("output: map lines", async () => {
  const uppercase = await run("echo", "hello")
    .lines
    .map((line) => line.toUpperCase())
    .collect();
  assertEquals(uppercase, ["HELLO"]);
});

Deno.test("output: filter lines", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "INFO: start\nERROR: fail\nINFO: end\n");

  try {
    const errors = await read(tempFile)
      .lines
      .filter((line) => line.includes("ERROR"))
      .collect();
    assertEquals(errors.length, 1);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("input: pipe from enumerable", async () => {
  const data = ["line 1", "line 2", "line 3"];
  const result = await enumerate(data)
    .run("grep", "2")
    .lines.collect();
  assertEquals(result, ["line 2"]);
});

Deno.test("resources: consume output", async () => {
  const lines = await run("echo", "test").lines.collect();
  assertEquals(lines, ["test"]);
});

// ===== Iterables Examples =====

Deno.test("enumerable: map", async () => {
  const doubled = await enumerate([1, 2, 3])
    .map((n) => n * 2)
    .collect();
  assertEquals(doubled, [2, 4, 6]);
});

Deno.test("enumerable: filter", async () => {
  const evens = await enumerate([1, 2, 3, 4])
    .filter((n) => n % 2 === 0)
    .collect();
  assertEquals(evens, [2, 4]);
});

Deno.test("enumerable: reduce", async () => {
  const sum = await enumerate([1, 2, 3, 4])
    .reduce((acc, n) => acc + n, 0);
  assertEquals(sum, 10);
});

Deno.test("array-methods: flatMap", async () => {
  const words = await enumerate(["hello world", "foo bar"])
    .flatMap((line) => line.split(" "))
    .collect();
  assertEquals(words, ["hello", "world", "foo", "bar"]);
});

Deno.test("array-methods: count", async () => {
  const count = await enumerate([1, 2, 3]).count();
  assertEquals(count, 3);
});

Deno.test("array-methods: some", async () => {
  const hasError = await enumerate(["INFO", "ERROR", "WARN"])
    .some((line) => line.includes("ERROR"));
  assertEquals(hasError, true);
});

Deno.test("array-methods: every", async () => {
  const allPositive = await enumerate([1, 2, 3])
    .every((n) => n > 0);
  assertEquals(allPositive, true);
});

Deno.test("array-methods: find", async () => {
  const match = await enumerate([1, 2, 3, 4])
    .find((n) => n > 2);
  assertEquals(match, 3);
});

Deno.test("transformations: map with async", async () => {
  const results = await enumerate([1, 2, 3])
    .map(async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n * 2;
    })
    .collect();
  assertEquals(results, [2, 4, 6]);
});

Deno.test("aggregations: build object", async () => {
  const items = [{ cat: "A", val: 1 }, { cat: "B", val: 2 }, {
    cat: "A",
    val: 3,
  }];
  const grouped = await enumerate(items)
    .reduce((acc, item) => {
      acc[item.cat] = acc[item.cat] || [];
      acc[item.cat].push(item.val);
      return acc;
    }, {} as Record<string, number[]>);
  assertEquals(grouped.A, [1, 3]);
  assertEquals(grouped.B, [2]);
});

Deno.test("slicing: take", async () => {
  const first3 = await enumerate([1, 2, 3, 4, 5])
    .take(3)
    .collect();
  assertEquals(first3, [1, 2, 3]);
});

Deno.test("slicing: drop", async () => {
  const rest = await enumerate([1, 2, 3, 4, 5])
    .drop(2)
    .collect();
  assertEquals(rest, [3, 4, 5]);
});

Deno.test("slicing: slice with drop and take", async () => {
  const middle = await enumerate([1, 2, 3, 4, 5])
    .drop(1)
    .take(3)
    .collect();
  assertEquals(middle, [2, 3, 4]);
});

// ===== Advanced Examples =====

Deno.test("concurrent: concurrentMap", async () => {
  const results = await enumerate([1, 2, 3])
    .concurrentMap(async (n) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n * 2;
    }, { concurrency: 2 })
    .collect();
  assertEquals(results, [2, 4, 6]);
});

Deno.test("streaming: count lines", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "line1\nline2\nline3\n");

  try {
    const count = await read(tempFile).lines.count();
    assertEquals(count, 3);
  } finally {
    await Deno.remove(tempFile);
  }
});

// ===== Utilities Examples =====

Deno.test("file-io: read and filter", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "line1\nERROR: test\nline3\n");

  try {
    const errors = await read(tempFile)
      .lines
      .filter((line) => line.includes("ERROR"))
      .collect();
    assertEquals(errors.length, 1);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("range: basic range", async () => {
  const numbers = await range({ to: 5 }).collect();
  assertEquals(numbers, [0, 1, 2, 3, 4]);
});

Deno.test("range: with step", async () => {
  const evens = await range({ from: 0, to: 10, step: 2 }).collect();
  assertEquals(evens, [0, 2, 4, 6, 8]);
});

Deno.test("zip-enumerate: enum", async () => {
  const indexed = await enumerate(["a", "b", "c"])
    .enum()
    .collect();
  assertEquals(indexed, [["a", 0], ["b", 1], ["c", 2]]);
});

// ===== Recipes Examples =====

Deno.test("decompression: decompress and count", async () => {
  const lineCount = await read("resources/warandpeace.txt.gz")
    .transform(
      new DecompressionStream("gzip") as TransformStream<
        Uint8Array,
        Uint8Array
      >,
    )
    .lines
    .count();
  assertEquals(lineCount, 23166);
});

Deno.test("custom-transformations examples", async (t) => {
  await t.step("batching", async () => {
    async function* batch<T>(items: AsyncIterable<T>, size: number) {
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

    const batches = await enumerate([1, 2, 3, 4, 5, 6, 7])
      .transform((items) => batch(items, 3))
      .collect();

    assertEquals(batches, [[1, 2, 3], [4, 5, 6], [7]]);
  });

  await t.step("running-average", async () => {
    async function* runningAverage(numbers: AsyncIterable<number>) {
      let sum = 0;
      let count = 0;

      for await (const num of numbers) {
        sum += num;
        count++;
        yield sum / count;
      }
    }

    const averages = await enumerate([10, 20, 30, 40])
      .transform(runningAverage)
      .collect();

    assertEquals(averages, [10, 15, 20, 25]);
  });

  await t.step("parse-json-lines", async () => {
    interface LogEntry {
      id: string;
      timestamp: string;
      level: string;
      message: string;
    }

    async function* parseJsonLines(lines: AsyncIterable<string>) {
      for await (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const obj = JSON.parse(trimmed);

          if (obj.id && obj.timestamp && obj.level && obj.message) {
            yield obj as LogEntry;
          }
        } catch {
          // Skip invalid JSON silently
        }
      }
    }

    const logs = await enumerate([
      '{"id":"1","timestamp":"2024-01-01","level":"info","message":"Started"}',
      "invalid json line",
      '{"id":"2","timestamp":"2024-01-01","level":"error","message":"Failed"}',
      "",
    ]).transform(parseJsonLines).collect();

    assertEquals(logs.length, 2);
    assertEquals(logs[0].id, "1");
    assertEquals(logs[1].id, "2");
  });

  await t.step("throttle", async () => {
    async function* throttle<T>(items: AsyncIterable<T>, delayMs: number) {
      let first = true;

      for await (const item of items) {
        if (!first) {
          await sleep(delayMs);
        }
        first = false;
        yield item;
      }
    }

    const start = Date.now();
    const results = await enumerate(["a", "b", "c"])
      .transform((items) => throttle(items, 50))
      .collect();
    const elapsed = Date.now() - start;

    assertEquals(results, ["a", "b", "c"]);
    // Should take at least 100ms (2 delays of 50ms each)
    assert(elapsed >= 90, `Expected at least 90ms, got ${elapsed}ms`);
  });

  await t.step("multi-stage", async () => {
    async function* processLogEntries(lines: AsyncIterable<string>) {
      for await (const line of lines) {
        try {
          const entry = JSON.parse(line);

          if (entry.level !== "error") continue;

          const enriched = {
            ...entry,
            processedAt: new Date().toISOString(),
            severity: entry.message.toLowerCase().includes("critical")
              ? "high"
              : "medium",
          };

          yield {
            timestamp: enriched.timestamp,
            severity: enriched.severity,
            summary: enriched.message.substring(0, 100),
          };
        } catch {
          // Skip invalid entries
        }
      }
    }

    const processed = await enumerate([
      '{"level":"info","message":"System started","timestamp":"2024-01-01T10:00:00Z"}',
      '{"level":"error","message":"Critical database failure","timestamp":"2024-01-01T10:01:00Z"}',
      '{"level":"error","message":"Minor timeout","timestamp":"2024-01-01T10:02:00Z"}',
    ]).transform(processLogEntries).collect();

    assertEquals(processed.length, 2);
    assertEquals(processed[0].severity, "high"); // "Critical database failure" contains "critical"
    assertEquals(processed[1].severity, "medium"); // "Minor timeout" doesn't contain "critical"
  });

  await t.step("best-practices", async () => {
    interface User {
      id: string;
      name: string;
      email: string;
    }

    function isValidUser(user: unknown): user is User {
      return user != null &&
        typeof user === "object" &&
        typeof (user as Record<string, unknown>).id === "string" &&
        typeof (user as Record<string, unknown>).name === "string" &&
        typeof (user as Record<string, unknown>).email === "string";
    }

    async function* parseAndValidateUsers(
      lines: AsyncIterable<string>,
    ): AsyncGenerator<User> {
      for await (const line of lines) {
        try {
          const user = JSON.parse(line) as User;
          if (isValidUser(user)) {
            yield user;
          }
        } catch {
          // Skip invalid user data
        }
      }
    }

    const users = await enumerate([
      '{"id":"1","name":"Alice","email":"alice@example.com"}',
      '{"id":"2","name":"Bob"}', // Missing email
      '{"id":"3","name":"Charlie","email":"charlie@example.com"}',
    ]).transform(parseAndValidateUsers).collect();

    assertEquals(users.length, 2);
    assertEquals(users[0].name, "Alice");
    assertEquals(users[1].name, "Charlie");
  });
});

Deno.test("log-processing: count errors", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(
    tempFile,
    "INFO: start\nERROR: fail\nINFO: ok\nERROR: bad\n",
  );

  try {
    const errorCount = await read(tempFile)
      .lines
      .filter((line) => line.includes("ERROR"))
      .count();
    assertEquals(errorCount, 2);
  } finally {
    await Deno.remove(tempFile);
  }
});
