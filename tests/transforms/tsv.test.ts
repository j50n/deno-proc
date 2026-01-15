import { assertEquals, assertThrows } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  fromTsvToLazyRows,
  fromTsvToRows,
  toTsv,
} from "../../src/transforms/tsv.ts";

Deno.test("TSV - basic parsing to rows", async () => {
  const tsvData = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, [
    [
      { name: "Alice", age: "30", city: "NYC" },
      { name: "Bob", age: "25", city: "LA" },
    ],
  ]);
});

Deno.test("TSV - basic parsing to LazyRows", async () => {
  const tsvData = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToLazyRows())
    .collect();

  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // header + 2 data rows
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("TSV - chunked input", async () => {
  const chunks = ["name\tage\n", "Alice\t30\n", "Bob\t25"];

  const result = await enumerate(chunks.map((s) => new TextEncoder().encode(s)))
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ],
  ]);
});

Deno.test("TSV - empty fields", async () => {
  const tsvData = "name\tage\tcity\nAlice\t\tNYC\nBob\t25\t";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, [
    [
      { name: "Alice", age: "", city: "NYC" },
      { name: "Bob", age: "25", city: "" },
    ],
  ]);
});

Deno.test("TSV - stringify from rows", async () => {
  const data = [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" },
    ],
  ];

  const result = await enumerate(data)
    .transform(toTsv())
    .collect();

  const tsvText = new TextDecoder().decode(result[0]);
  assertEquals(tsvText, "Alice\t30\nBob\t25\n");
});

Deno.test("TSV - stringify from LazyRows", async () => {
  const tsvData = "Alice\t30\nBob\t25";

  // First parse to LazyRows
  const lazyRows = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToLazyRows())
    .collect();

  // Then stringify back
  const result = await enumerate(lazyRows)
    .transform(toTsv())
    .collect();

  const tsvText = new TextDecoder().decode(result[0]);
  assertEquals(tsvText, "Alice\t30\nBob\t25\n");
});

Deno.test("TSV - round trip rows", async () => {
  const originalTsv = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";

  // Parse to rows
  const rows = await enumerate([new TextEncoder().encode(originalTsv)])
    .transform(fromTsvToRows())
    .collect();

  // Convert back to TSV
  const tsvBytes = await enumerate(rows)
    .transform(toTsv())
    .collect();

  const resultTsv = new TextDecoder().decode(tsvBytes[0]);
  // Note: We lose headers in Row conversion, so we only check data rows
  assertEquals(resultTsv, "Alice\t30\tNYC\nBob\t25\tLA\n");
});

Deno.test("TSV - multi-byte UTF-8 handling", async () => {
  const tsvData = "name\tcity\temoji\n北京\t中国\t🏙️\nTokyo\t日本\t🗾";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, [
    [
      { name: "北京", city: "中国", emoji: "🏙️" },
      { name: "Tokyo", city: "日本", emoji: "🗾" },
    ],
  ]);
});

Deno.test("TSV - multi-byte UTF-8 chunked at boundaries", async () => {
  const text = "name\tcity\n北京\t中国";
  const bytes = new TextEncoder().encode(text);

  // Split at a position that breaks a multi-byte character
  const chunk1 = bytes.slice(0, 15);
  const chunk2 = bytes.slice(15);

  const result = await enumerate([chunk1, chunk2])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, [
    [{ name: "北京", city: "中国" }],
  ]);
});

Deno.test("TSV - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, []);
});

Deno.test("TSV - only headers", async () => {
  const tsvData = "name\tage\tcity";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result, []);
});

// Error handling tests
Deno.test("TSV - invalid UTF-8 throws", async () => {
  const invalidUtf8 = new Uint8Array([0xFF, 0xFE, 0xFD]);

  try {
    const result = enumerate([invalidUtf8]).transform(fromTsvToRows());
    for await (const batch of result) {
      // Should throw before we get here
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(error instanceof TypeError, true);
  }
});

Deno.test("TSV - data with embedded tabs throws error", async () => {
  const data = [
    [
      { name: "Alice", description: "Has\ttabs" },
      { name: "Bob", description: "Normal" },
    ],
  ];

  try {
    const result = enumerate(data).transform(toTsv());
    for await (const chunk of result) {
      // Should throw before we get here
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message.includes("Invalid character (tab)"),
      true,
    );
    assertEquals((error as Error).message.includes("row 1"), true);
  }
});

Deno.test("TSV - data with embedded CR throws error", async () => {
  const data = [
    [
      { name: "Alice", description: "Has\rCR" },
    ],
  ];

  try {
    const result = enumerate(data).transform(toTsv());
    for await (const chunk of result) {
      // Should throw before we get here
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message.includes("Invalid character (CR)"),
      true,
    );
  }
});

Deno.test("TSV - data with embedded LF throws error", async () => {
  const data = [
    [
      { name: "Alice", description: "Has\nLF" },
    ],
  ];

  try {
    const result = enumerate(data).transform(toTsv());
    for await (const chunk of result) {
      // Should throw before we get here
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(
      (error as Error).message.includes("Invalid character (LF)"),
      true,
    );
  }
});

Deno.test("TSV - LazyRow selective access", async () => {
  const tsvData =
    "name\tage\tcity\tcountry\tcontinent\nAlice\t30\tNYC\tUSA\tNorth America\nBob\t25\tLA\tUSA\tNorth America";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToLazyRows())
    .collect();

  const rows = result[0];

  // Test selective access - only get name and city (indices 0 and 2)
  assertEquals(rows[1].getField(0), "Alice"); // name
  assertEquals(rows[1].getField(2), "NYC"); // city
  assertEquals(rows[2].getField(0), "Bob"); // name
  assertEquals(rows[2].getField(2), "LA"); // city
});

// =============================================================================
// Pathological Data Tests
// =============================================================================

/** Generate random alphanumeric string of given length */
function randomString(len: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const result = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    result[i] = chars[Math.floor(Math.random() * chars.length)];
  }
  return result.join("");
}

Deno.test("TSV pathological - 1MB field", async () => {
  const hugeField = randomString(1_000_000);
  const tsvData = `header1\theader2\theader3\nsmall\t${hugeField}\tend\n`;

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result[0][0].header1, "small");
  assertEquals(result[0][0].header2, hugeField);
  assertEquals(result[0][0].header3, "end");
});

Deno.test("TSV pathological - many fields (100 columns)", async () => {
  const headers = Array.from({ length: 100 }, (_, i) => `h${i}`);
  const values = Array.from({ length: 100 }, (_, i) => `v${i}`);
  const tsvData = headers.join("\t") + "\n" + values.join("\t") + "\n";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(Object.keys(result[0][0]).length, 100);
  assertEquals(result[0][0].h0, "v0");
  assertEquals(result[0][0].h99, "v99");
});

Deno.test("TSV pathological - many rows (10000 rows)", async () => {
  const header = "a\tb\tc\n";
  const rows = Array.from({ length: 10000 }, (_, i) => `a${i}\tb${i}\tc${i}`);
  const tsvData = header + rows.join("\n") + "\n";

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  const allRows = result.flat();
  assertEquals(allRows.length, 10000);
  assertEquals(allRows[0].a, "a0");
  assertEquals(allRows[9999].a, "a9999");
});

Deno.test("TSV pathological - 1MB field to LazyRow", async () => {
  const hugeField = randomString(1_000_000);
  const tsvData = `small\t${hugeField}\tend\n`;

  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToLazyRows())
    .collect();

  assertEquals(result[0][0].getField(0), "small");
  assertEquals(result[0][0].getField(1), hugeField);
  assertEquals(result[0][0].getField(2), "end");
});

Deno.test("TSV pathological - chunk boundary in middle of field", async () => {
  const field = "a".repeat(100);
  const tsvData = `h1\th2\n${field}\t${field}\n`;
  const bytes = new TextEncoder().encode(tsvData);

  // Split in middle of first data field
  const chunk1 = bytes.slice(0, 60);
  const chunk2 = bytes.slice(60);

  const result = await enumerate([chunk1, chunk2])
    .transform(fromTsvToRows())
    .collect();

  assertEquals(result[0][0].h1, field);
  assertEquals(result[0][0].h2, field);
});

Deno.test("TSV pathological - many small chunks", async () => {
  const tsvData = "a\tb\tc\nd\te\tf\ng\th\ti\n";
  const bytes = new TextEncoder().encode(tsvData);

  // Split into 1-byte chunks
  const chunks = Array.from(bytes).map((b) => new Uint8Array([b]));

  const result = await enumerate(chunks)
    .transform(fromTsvToLazyRows())
    .collect();

  const allRows = result.flat();
  assertEquals(allRows.length, 3);
  assertEquals(allRows[0].toStringArray(), ["a", "b", "c"]);
});

Deno.test("TSV pathological - round-trip with 1MB field", async () => {
  const hugeField = randomString(1_000_000);
  const tsvData = `h1\th2\nsmall\t${hugeField}\n`;

  // Parse to rows
  const rows = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvToRows())
    .collect();

  // Convert back to TSV
  const tsvBytes = await enumerate(rows)
    .transform(toTsv())
    .collect();

  const resultTsv = new TextDecoder().decode(tsvBytes[0]);
  assertEquals(resultTsv, `small\t${hugeField}\n`);
});
