import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromTsvBytes, fromTsvBytesToBinaryRow, toTsvBytes } from "../../src/transforms/tsv.ts";

Deno.test("TSV - basic parsing to RowData", async () => {
  const tsvData = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";
  
  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30", city: "NYC" },
      { name: "Bob", age: "25", city: "LA" }
    ]
  ]);
});

Deno.test("TSV - basic parsing to BinaryRow", async () => {
  const tsvData = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";
  
  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytesToBinaryRow)
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // header + 2 data rows
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("TSV - chunked input", async () => {
  const chunks = ["name\tage\n", "Alice\t30\n", "Bob\t25"];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]
  ]);
});

Deno.test("TSV - empty fields", async () => {
  const tsvData = "name\tage\tcity\nAlice\t\tNYC\nBob\t25\t";
  
  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "", city: "NYC" },
      { name: "Bob", age: "25", city: "" }
    ]
  ]);
});

Deno.test("TSV - stringify from RowData", async () => {
  const data = [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]
  ];
  
  const result = await enumerate(data)
    .transform(toTsvBytes)
    .collect();
  
  const tsvText = new TextDecoder().decode(result[0]);
  assertEquals(tsvText, "Alice\t30\nBob\t25\n");
});

Deno.test("TSV - stringify from BinaryRow", async () => {
  const tsvData = "Alice\t30\nBob\t25";
  
  // First parse to BinaryRow
  const binaryRows = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytesToBinaryRow)
    .collect();
  
  // Then stringify back
  const result = await enumerate(binaryRows)
    .transform(toTsvBytes)
    .collect();
  
  const tsvText = new TextDecoder().decode(result[0]);
  assertEquals(tsvText, "Alice\t30\nBob\t25\n");
});

Deno.test("TSV - round trip RowData", async () => {
  const originalTsv = "name\tage\tcity\nAlice\t30\tNYC\nBob\t25\tLA";
  
  // Parse to RowData
  const rowData = await enumerate([new TextEncoder().encode(originalTsv)])
    .transform(fromTsvBytes)
    .collect();
  
  // Convert back to TSV
  const tsvBytes = await enumerate(rowData)
    .transform(toTsvBytes)
    .collect();
  
  const resultTsv = new TextDecoder().decode(tsvBytes[0]);
  // Note: We lose headers in RowData conversion, so we only check data rows
  assertEquals(resultTsv, "Alice\t30\tNYC\nBob\t25\tLA\n");
});

Deno.test("TSV - UTF-8 handling", async () => {
  const tsvData = "name\tcity\n北京\t中国\nTokyo\t日本";
  
  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "北京", city: "中国" },
      { name: "Tokyo", city: "日本" }
    ]
  ]);
});

Deno.test("TSV - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, []);
});

Deno.test("TSV - only headers", async () => {
  const tsvData = "name\tage\tcity";
  
  const result = await enumerate([new TextEncoder().encode(tsvData)])
    .transform(fromTsvBytes)
    .collect();
  
  assertEquals(result, []);
});
