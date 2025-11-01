import { assertEquals } from "@std/assert";
import { run } from "../../src/run.ts";

Deno.test("run - basic command execution", async () => {
  const result = await run("echo", "hello").lines.collect();
  assertEquals(result, ["hello"]);
});

Deno.test("run - pipe commands together", async () => {
  const result = await run("echo", "HELLO")
    .run("tr", "A-Z", "a-z")
    .lines
    .first;
  assertEquals(result, "hello");
});

Deno.test("run - process lines with map", async () => {
  const lines = await run("echo", "-e", "1\\n2\\n3")
    .lines
    .map((line) => parseInt(line))
    .collect();
  assertEquals(lines, [1, 2, 3]);
});

Deno.test("run - count output lines", async () => {
  const count = await run("echo", "-e", "a\\nb\\nc").lines.count();
  assertEquals(count, 3);
});
