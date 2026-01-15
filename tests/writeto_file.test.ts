import { assertEquals } from "@std/assert";
import { enumerate } from "../mod.ts";

Deno.test("writeTo - write to file path", async () => {
  const tempFile = await Deno.makeTempFile();

  try {
    // Write some data to a file using string path
    await enumerate(["line1", "line2", "line3"])
      .map((line) => new TextEncoder().encode(line + "\n"))
      .writeTo(tempFile);

    // Read it back and verify
    const content = await Deno.readTextFile(tempFile);
    assertEquals(content, "line1\nline2\nline3\n");
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("writeTo - write bytes to file path", async () => {
  const tempFile = await Deno.makeTempFile();

  try {
    const data = new TextEncoder().encode("Hello, World!");
    await enumerate([data])
      .writeTo(tempFile);

    const content = await Deno.readTextFile(tempFile);
    assertEquals(content, "Hello, World!");
  } finally {
    await Deno.remove(tempFile);
  }
});

Deno.test("writeTo - file path with transforms", async () => {
  const tempFile = await Deno.makeTempFile();

  try {
    // Create a simple CSV-like content
    const lines = [
      "name,age",
      "Alice,30",
      "Bob,25",
    ];

    await enumerate(lines)
      .map((line) => new TextEncoder().encode(line + "\n"))
      .writeTo(tempFile);

    // Read back and verify
    const content = await Deno.readTextFile(tempFile);
    assertEquals(content, "name,age\nAlice,30\nBob,25\n");
  } finally {
    await Deno.remove(tempFile);
  }
});
