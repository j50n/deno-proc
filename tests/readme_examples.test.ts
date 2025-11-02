import { assertEquals } from "@std/assert";
import * as proc from "../mod.ts";
import { enumerate, read } from "../mod.ts";

Deno.test("README example: stream and decompress large file", async () => {
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

Deno.test("README example: run and pipe output", async () => {
  const result = await proc.run("echo", "hello").lines.collect();
  assertEquals(result, ["hello"]);
});

Deno.test("README example: chain processes like shell pipeline", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(tempFile, "line1\nerror here\nline3\nerror again\n");

  try {
    const result = await proc.run("cat", tempFile)
      .run("grep", "error")
      .run("wc", "-l")
      .lines
      .first;

    assertEquals(result?.trim(), "2");
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("README example: work with async iterables using Array methods", async () => {
  const lines = proc.run(
    "echo",
    "-e",
    "fix: bug\\nfeat: new\\nfix: another\\nchore: update",
  )
    .lines
    .map((line) => line.trim())
    .filter((line) => line.includes("fix"))
    .take(5);

  const results: string[] = [];
  for await (const line of lines) {
    results.push(line);
  }

  assertEquals(results.length, 2);
  assertEquals(results[0], "fix: bug");
  assertEquals(results[1], "fix: another");
});

Deno.test("README example: capture output", async () => {
  const result = await proc.run("echo", "abc123").lines.first;
  assertEquals(result, "abc123");
});

Deno.test("README example: handle errors gracefully", async () => {
  let errorCode: number | undefined;

  try {
    // Errors propagate through the entire pipeline
    await proc.run("sh", "-c", "exit 42")
      .lines
      .map((line) => line.toUpperCase())
      .filter((line) => line.includes("FAIL"))
      .toStdout();
  } catch (error) {
    // Handle all errors in one place
    if (error && typeof error === "object" && "code" in error) {
      errorCode = (error as { code: number }).code;
    }
  }

  assertEquals(errorCode, 42);
});

Deno.test("README example: transform async iterables", async () => {
  const data = ["apple", "banana", "cherry"];

  const numbered = await enumerate(data)
    .enum()
    .map(([fruit, i]) => `${i + 1}. ${fruit}`)
    .collect();

  assertEquals(numbered, ["1. apple", "2. banana", "3. cherry"]);
});

Deno.test("README example: process large files efficiently", async () => {
  const tempFile = await Deno.makeTempFile();
  await Deno.writeTextFile(
    tempFile,
    "INFO: starting\nERROR: failed\nINFO: retry\nERROR: timeout\nINFO: done\n",
  );

  try {
    const errorCount = await read(tempFile)
      .lines
      .filter((line) => line.includes("ERROR"))
      .reduce((count) => count + 1, 0);

    assertEquals(errorCount, 2);
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("README example: parallel processing with concurrency control", async () => {
  let fetchCount = 0;
  const mockUrls = ["url1", "url2", "url3"];

  const results = await enumerate(mockUrls)
    .concurrentMap(async (url) => {
      fetchCount++;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return { url, status: 200 };
    }, { concurrency: 5 })
    .collect();

  assertEquals(results.length, 3);
  assertEquals(results[0].url, "url1");
  assertEquals(results[1].url, "url2");
  assertEquals(results[2].url, "url3");
  assertEquals(fetchCount, 3);
  results.forEach((r) => assertEquals(r.status, 200));
});
