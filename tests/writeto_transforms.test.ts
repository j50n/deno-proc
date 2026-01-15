import { assertEquals } from "@std/assert";
import { enumerate, read } from "../mod.ts";
import { toBytes } from "../src/transformers.ts";

Deno.test("writeTo - write lines to file", async () => {
  const outFile = await Deno.makeTempFile({ suffix: ".txt" });
  
  try {
    // Write lines to file
    await enumerate(["line1", "line2", "line3"])
      .transform(toBytes)
      .writeTo(outFile);
    
    // Read back and verify
    const content = await Deno.readTextFile(outFile);
    assertEquals(content, 'line1\nline2\nline3\n');
  } finally {
    await Deno.remove(outFile);
  }
});

Deno.test("writeTo - read and write file", async () => {
  const inFile = await Deno.makeTempFile({ suffix: ".txt" });
  const outFile = await Deno.makeTempFile({ suffix: ".txt" });
  
  try {
    // Create input file
    await Deno.writeTextFile(inFile, 'Hello\nWorld\n');
    
    // Read and write using file paths
    await read(inFile)
      .writeTo(outFile);
    
    // Verify
    const content = await Deno.readTextFile(outFile);
    assertEquals(content, 'Hello\nWorld\n');
  } finally {
    await Deno.remove(inFile);
    await Deno.remove(outFile);
  }
});
