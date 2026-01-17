import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import {
  fromCsvToLazyRows,
  fromCsvToRows,
  toCsv,
} from "../../src/transforms/csv.ts";

// ============================================================================
// RFC 4180 Compliance Tests
// ============================================================================

Deno.test("CSV - basic parsing to rows", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]],
  ]);
});

Deno.test("CSV - basic parsing to LazyRows", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();

  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3);
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("CSV - RFC 4180: quoted fields with commas", async () => {
  const csvData =
    'name,description\n"Smith, John","Engineer"\n"Doe, Jane","Manager"';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "description"],
      ["Smith, John", "Engineer"],
      ["Doe, Jane", "Manager"],
    ],
  ]);
});

Deno.test("CSV - RFC 4180: escaped quotes (double quotes)", async () => {
  const csvData =
    'name,quote\n"Alice","She said ""hello"""\n"Bob","He said ""goodbye"""';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "quote"],
      ["Alice", 'She said "hello"'],
      ["Bob", 'He said "goodbye"'],
    ],
  ]);
});

Deno.test("CSV - RFC 4180: quoted fields with newlines", async () => {
  const csvData =
    'name,address\n"Alice","123 Main St\nApt 4B\nNYC"\n"Bob","456 Oak Ave"';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "address"],
      ["Alice", "123 Main St\nApt 4B\nNYC"],
      ["Bob", "456 Oak Ave"],
    ],
  ]);
});

Deno.test("CSV - RFC 4180: CRLF line endings", async () => {
  const csvData = "name,age\r\nAlice,30\r\nBob,25";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ]);
});

Deno.test("CSV - RFC 4180: CRLF with trailing", async () => {
  const csvData = "name,age\r\nAlice,30\r\nBob,25\r\n";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ]);
});

Deno.test("CSV - RFC 4180: mixed line endings", async () => {
  const csvData = "name,age\r\nAlice,30\nBob,25\r\n";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ]);
});

Deno.test("CSV - RFC 4180: mixed quoted and unquoted fields", async () => {
  const csvData = 'name,"age",city\nAlice,30,"New York"\n"Bob",25,LA';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "New York"], ["Bob", "25", "LA"]],
  ]);
});

Deno.test("CSV - RFC 4180: empty fields", async () => {
  const csvData = "name,age,city\nAlice,,NYC\n,25,LA\n,,";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "", "NYC"], ["", "25", "LA"], [
      "",
      "",
      "",
    ]],
  ]);
});

Deno.test("CSV - RFC 4180: quoted empty fields", async () => {
  const csvData = 'name,age,city\n"Alice","","NYC"\n"","25","LA"';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "", "NYC"], ["", "25", "LA"]],
  ]);
});

Deno.test("CSV - RFC 4180: single field per row", async () => {
  const csvData = "name\nAlice\nBob\nCharlie";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name"], ["Alice"], ["Bob"], ["Charlie"]],
  ]);
});

Deno.test("CSV - RFC 4180: trailing comma creates empty field", async () => {
  const csvData = "name,age,\nAlice,30,\nBob,25,";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", ""], ["Alice", "30", ""], ["Bob", "25", ""]],
  ]);
});

// ============================================================================
// Custom Separator Tests
// ============================================================================

Deno.test("CSV - custom separator (semicolon)", async () => {
  const csvData = "name;age;city\nAlice;30;NYC\nBob;25;LA";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: ";" }))
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]],
  ]);
});

Deno.test("CSV - custom separator (pipe)", async () => {
  const csvData = "name|age|city\nAlice|30|NYC\nBob|25|LA";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: "|" }))
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]],
  ]);
});

Deno.test("CSV - custom separator with quoted fields", async () => {
  const csvData =
    'name;description\n"Alice";"Has ; semicolon"\n"Bob";"Normal text"';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: ";" }))
    .collect();

  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", "Has ; semicolon"],
      ["Bob", "Normal text"],
    ],
  ]);
});

// ============================================================================
// Streaming and Chunking Tests
// ============================================================================

Deno.test("CSV - chunked input", async () => {
  const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];

  const result = await enumerate(chunks.map((s) => new TextEncoder().encode(s)))
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ]);
});

Deno.test("CSV - chunk boundary in quoted field", async () => {
  const chunks = [
    'name,desc\n"Alice","This is a ',
    'long description"\n"Bob","Short"',
  ];

  const result = await enumerate(chunks.map((s) => new TextEncoder().encode(s)))
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "desc"],
      ["Alice", "This is a long description"],
      ["Bob", "Short"],
    ],
  ]);
});

Deno.test("CSV - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, []);
});

Deno.test("CSV - empty batch", async () => {
  const input: string[][][] = [[]];
  const result = await enumerate(input)
    .transform(toCsv())
    .collect();

  assertEquals(result.length, 1);
  assertEquals(result[0].length, 0);
});

Deno.test("CSV - empty batch followed by data", async () => {
  const input: string[][][] = [[], [["a", "b"], ["c", "d"]]];
  const result = await enumerate(input)
    .transform(toCsv())
    .collect();

  assertEquals(result.length, 2);
  assertEquals(result[0].length, 0);
  const csvText = new TextDecoder().decode(result[1]);
  assertEquals(csvText, "a,b\nc,d\n");
});

// ============================================================================
// UTF-8 Tests
// ============================================================================

Deno.test("CSV - multi-byte UTF-8 handling", async () => {
  const csvData =
    "name,emoji,language\nAlice,😀,English\nBob,🎉,日本語\nCharlie,🚀,中文";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "emoji", "language"],
      ["Alice", "😀", "English"],
      ["Bob", "🎉", "日本語"],
      ["Charlie", "🚀", "中文"],
    ],
  ]);
});

Deno.test("CSV - multi-byte UTF-8 in quoted fields", async () => {
  const csvData = 'name,message\n"Alice","Hello 世界"\n"Bob","Bonjour 🌍"';

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [
      ["name", "message"],
      ["Alice", "Hello 世界"],
      ["Bob", "Bonjour 🌍"],
    ],
  ]);
});

// ============================================================================
// CSV Generation Tests
// ============================================================================

Deno.test("CSV - stringify basic", async () => {
  const data = [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ];

  const result = await enumerate(data)
    .transform(toCsv())
    .collect();

  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name,age\nAlice,30\nBob,25\n");
});

Deno.test("CSV - stringify from single row", async () => {
  const data = [
    ["name", "age"],
    ["Alice", "30"],
    ["Bob", "25"],
  ];

  const result = await enumerate(data)
    .transform(toCsv())
    .collect();

  const csvText = result.map((b) => new TextDecoder().decode(b)).join("");
  assertEquals(csvText, "name,age\nAlice,30\nBob,25\n");
});

Deno.test("CSV - stringify with custom separator", async () => {
  const data = [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]],
  ];

  const result = await enumerate(data)
    .transform(toCsv({ separator: ";" }))
    .collect();

  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name;age\nAlice;30\nBob;25\n");
});

Deno.test("CSV - stringify with CRLF", async () => {
  const data = [
    [["name", "age"], ["Alice", "30"]],
  ];

  const result = await enumerate(data)
    .transform(toCsv({ crlf: true }))
    .collect();

  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name,age\r\nAlice,30\r\n");
});

Deno.test("CSV - stringify fields requiring quotes", async () => {
  const data = [
    [["name", "description"], ["Alice", "Has, comma"], ["Bob", 'Has "quote"']],
  ];

  const result = await enumerate(data)
    .transform(toCsv())
    .collect();

  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(
    csvText,
    'name,description\nAlice,"Has, comma"\nBob,"Has ""quote"""\n',
  );
});

Deno.test("CSV - stringify from LazyRows", async () => {
  const csvData = "name,age\nAlice,30\nBob,25";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .transform(toCsv())
    .collect();

  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name,age\nAlice,30\nBob,25\n");
});

Deno.test("CSV - stringify from single LazyRow", async () => {
  const csvData = "name,age\nAlice,30\nBob,25";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .flatMap((batch) => batch)
    .transform(toCsv())
    .collect();

  const csvText = result.map((b) => new TextDecoder().decode(b)).join("");
  assertEquals(csvText, "name,age\nAlice,30\nBob,25\n");
});

Deno.test("CSV - round trip", async () => {
  const original =
    'name,description\n"Alice","Has, comma and ""quotes"""\n"Bob","Normal text"';

  const result = await enumerate([new TextEncoder().encode(original)])
    .transform(fromCsvToRows())
    .transform(toCsv())
    .collect();

  const csvText = new TextDecoder().decode(result[0]);

  // Parse both to compare data, not formatting
  const originalParsed = await enumerate([new TextEncoder().encode(original)])
    .transform(fromCsvToRows())
    .collect();
  const roundTripParsed = await enumerate([new TextEncoder().encode(csvText)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(roundTripParsed, originalParsed);
});

// ============================================================================
// LazyRow Specific Tests
// ============================================================================

Deno.test("CSV - LazyRow selective access", async () => {
  const csvData = "name,age,city,country,zip\nAlice,30,NYC,USA,10001";

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();

  const row = result[0][1];
  assertEquals(row.getField(0), "Alice");
  assertEquals(row.getField(2), "NYC");
  assertEquals(row.toStringArray().length, 5);
});

// ============================================================================
// Pathological Cases
// ============================================================================

Deno.test("CSV pathological - 1MB field", async () => {
  const largeField = "x".repeat(1024 * 1024);
  const csvData = `name,data\nAlice,"${largeField}"\nBob,small`;

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result[0][0], ["name", "data"]);
  assertEquals(result[0][1][0], "Alice");
  assertEquals(result[0][1][1].length, 1024 * 1024);
  assertEquals(result[0][2], ["Bob", "small"]);
});

Deno.test("CSV pathological - 1MB quoted field", async () => {
  const largeField = "x".repeat(1024 * 1024);
  const csvData = `name,data\n"Alice","${largeField}"\n"Bob","small"`;

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result[0][1][1].length, 1024 * 1024);
});

Deno.test("CSV pathological - many fields (100 columns)", async () => {
  const fields = Array.from({ length: 100 }, (_, i) => `field${i}`);
  const values = Array.from({ length: 100 }, (_, i) => `value${i}`);
  const csvData = fields.join(",") + "\n" + values.join(",");

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result[0][0], fields);
  assertEquals(result[0][1], values);
});

Deno.test("CSV pathological - many rows (10000 rows)", async () => {
  const rows = ["name,age"];
  for (let i = 0; i < 10000; i++) {
    rows.push(`Person${i},${20 + (i % 50)}`);
  }
  const csvData = rows.join("\n");

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .flatten()
    .collect();

  assertEquals(result.length, 10001); // header + 10000 rows
  assertEquals(result[0], ["name", "age"]);
  assertEquals(result[10000], ["Person9999", "69"]);
});

Deno.test("CSV pathological - 1MB field round-trip", async () => {
  const largeField = "x".repeat(1024 * 1024);
  const csvData = `name,data\nAlice,"${largeField}"`;

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .transform(toCsv())
    .collect();

  const csvText = new TextDecoder().decode(result[0]);

  // Parse to verify data integrity
  const parsed = await enumerate([new TextEncoder().encode(csvText)])
    .transform(fromCsvToRows())
    .collect();

  assertEquals(parsed[0][1][1].length, 1024 * 1024);
});

Deno.test("CSV pathological - 1MB field to LazyRow", async () => {
  const largeField = "x".repeat(1024 * 1024);
  const csvData = `name,data\nAlice,"${largeField}"`;

  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();

  assertEquals(result[0][1].getField(1).length, 1024 * 1024);
});

Deno.test("CSV pathological - chunk boundary in middle of field", async () => {
  const field = "a".repeat(1000);
  const csvData = `name,data\nAlice,${field}`;

  // Split in middle of the long field
  const chunk1 = csvData.slice(0, 20);
  const chunk2 = csvData.slice(20);

  const result = await enumerate(
    [chunk1, chunk2].map((s) => new TextEncoder().encode(s)),
  )
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result[0][1][1].length, 1000);
});

Deno.test("CSV pathological - chunk boundary in quoted field", async () => {
  const field = "a".repeat(1000);
  const csvData = `name,data\nAlice,"${field}"`;

  // Split in middle of the quoted field
  const chunk1 = csvData.slice(0, 25);
  const chunk2 = csvData.slice(25);

  const result = await enumerate(
    [chunk1, chunk2].map((s) => new TextEncoder().encode(s)),
  )
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result[0][1][1].length, 1000);
});

Deno.test("CSV pathological - many small chunks", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";
  const chunks = csvData.split("").map((c) => new TextEncoder().encode(c));

  const result = await enumerate(chunks)
    .transform(fromCsvToRows())
    .collect();

  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]],
  ]);
});
