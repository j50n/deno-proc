import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromRecordBytes, fromRecordBytesToBinaryRow, toRecordBytes } from "../../src/transforms/record.ts";
import { RECORD_SEPARATOR, FIELD_SEPARATOR } from "../../src/transforms/common.ts";

Deno.test("Record - basic parsing to RowData", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}LA${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30", city: "NYC" },
      { name: "Bob", age: "25", city: "LA" }
    ]
  ]);
});

Deno.test("Record - basic parsing to BinaryRow", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}LA${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytesToBinaryRow)
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // header + 2 data rows
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("Record - chunked input", async () => {
  const part1 = `name${FIELD_SEPARATOR}age${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}`;
  const part2 = `Bob${FIELD_SEPARATOR}25${RECORD_SEPARATOR}`;
  
  const result = await enumerate([part1, part2].map(s => new TextEncoder().encode(s)))
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]
  ]);
});

Deno.test("Record - empty fields", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "", city: "NYC" },
      { name: "Bob", age: "25", city: "" }
    ]
  ]);
});

Deno.test("Record - stringify from RowData", async () => {
  const data = [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]
  ];
  
  const result = await enumerate(data)
    .transform(toRecordBytes)
    .collect();
  
  const recordText = new TextDecoder().decode(result[0]);
  const expected = `Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${RECORD_SEPARATOR}`;
  assertEquals(recordText, expected);
});

Deno.test("Record - stringify from BinaryRow", async () => {
  const recordData = `Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${RECORD_SEPARATOR}`;
  
  // First parse to BinaryRow
  const binaryRows = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytesToBinaryRow)
    .collect();
  
  // Then stringify back
  const result = await enumerate(binaryRows)
    .transform(toRecordBytes)
    .collect();
  
  const recordText = new TextDecoder().decode(result[0]);
  assertEquals(recordText, recordData);
});

Deno.test("Record - special characters in data", async () => {
  // Record format should handle tabs and newlines in data since it uses different separators
  const recordData = `text${RECORD_SEPARATOR}line1\nline2${FIELD_SEPARATOR}tab\there${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytesToBinaryRow)
    .collect();
  
  assertEquals(result[0][0].toStringArray(), ["text"]);
  assertEquals(result[0][1].toStringArray(), ["line1\nline2", "tab\there"]);
});

Deno.test("Record - UTF-8 handling", async () => {
  const recordData = `name${FIELD_SEPARATOR}city${RECORD_SEPARATOR}北京${FIELD_SEPARATOR}中国${RECORD_SEPARATOR}Tokyo${FIELD_SEPARATOR}日本${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "北京", city: "中国" },
      { name: "Tokyo", city: "日本" }
    ]
  ]);
});

Deno.test("Record - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, []);
});

Deno.test("Record - only headers", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordBytes)
    .collect();
  
  assertEquals(result, []);
});
