import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromRecordToRows, fromRecordToLazyRows, toRecord } from "../../src/transforms/record.ts";
import { RECORD_SEPARATOR, FIELD_SEPARATOR } from "../../src/transforms/common.ts";

Deno.test("Record - basic parsing to RowData", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}LA${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // All 3 records including header
  assertEquals(result[0][0], ["name", "age", "city"]); // Header row
  assertEquals(result[0][1], ["Alice", "30", "NYC"]);
  assertEquals(result[0][2], ["Bob", "25", "LA"]);
});

Deno.test("Record - basic parsing to LazyRow", async () => {
  const recordData = `name${FIELD_SEPARATOR}age${FIELD_SEPARATOR}city${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}LA${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToLazyRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // header + 2 data rows
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("Record - stringify from RowData", async () => {
  const data = [
    ["Alice", "30", "NYC"],
    ["Bob", "25", "LA"]
  ];
  
  const result = await enumerate([data])
    .transform(toRecord())
    .collect();
  
  const output = new TextDecoder().decode(result[0]);
  const expected = `Alice${FIELD_SEPARATOR}30${FIELD_SEPARATOR}NYC${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${FIELD_SEPARATOR}LA${RECORD_SEPARATOR}`;
  assertEquals(output, expected);
});

Deno.test("Record - round trip", async () => {
  const originalData = `name${FIELD_SEPARATOR}age${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${RECORD_SEPARATOR}`;
  
  const parsed = await enumerate([new TextEncoder().encode(originalData)])
    .transform(fromRecordToRows())
    .collect();
  
  const stringified = await enumerate(parsed)
    .transform(toRecord())
    .collect();
  
  const output = new TextDecoder().decode(stringified[0]);
  assertEquals(output, `name${FIELD_SEPARATOR}age${RECORD_SEPARATOR}Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}Bob${FIELD_SEPARATOR}25${RECORD_SEPARATOR}`);
});

// =============================================================================
// Additional Tests
// =============================================================================

Deno.test("Record - chunked input", async () => {
  const chunk1 = `name${FIELD_SEPARATOR}age${RECORD_SEPARATOR}`;
  const chunk2 = `Alice${FIELD_SEPARATOR}30${RECORD_SEPARATOR}`;
  
  const result = await enumerate([
    new TextEncoder().encode(chunk1),
    new TextEncoder().encode(chunk2)
  ])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result.flat().length, 2);
});

Deno.test("Record - empty fields", async () => {
  const recordData = `${FIELD_SEPARATOR}middle${FIELD_SEPARATOR}${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result[0][0], ["", "middle", ""]);
});

Deno.test("Record - multi-byte UTF-8", async () => {
  const recordData = `北京${FIELD_SEPARATOR}中国${FIELD_SEPARATOR}🏙️${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result[0][0], ["北京", "中国", "🏙️"]);
});

// =============================================================================
// Pathological Data Tests
// =============================================================================

/** Generate random alphanumeric string of given length */
function randomString(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const result = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    result[i] = chars[Math.floor(Math.random() * chars.length)];
  }
  return result.join("");
}

Deno.test("Record pathological - 1MB field", async () => {
  const hugeField = randomString(1_000_000);
  const recordData = `small${FIELD_SEPARATOR}${hugeField}${FIELD_SEPARATOR}end${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result[0][0][0], "small");
  assertEquals(result[0][0][1], hugeField);
  assertEquals(result[0][0][2], "end");
});

Deno.test("Record pathological - many fields (100 columns)", async () => {
  const fields = Array.from({ length: 100 }, (_, i) => `field${i}`);
  const recordData = fields.join(FIELD_SEPARATOR) + RECORD_SEPARATOR;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result[0][0].length, 100);
  assertEquals(result[0][0][0], "field0");
  assertEquals(result[0][0][99], "field99");
});

Deno.test("Record pathological - many rows (10000 rows)", async () => {
  const rows = Array.from({ length: 10000 }, (_, i) => 
    `a${i}${FIELD_SEPARATOR}b${i}${FIELD_SEPARATOR}c${i}${RECORD_SEPARATOR}`
  );
  const recordData = rows.join("");
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToRows())
    .collect();
  
  const allRows = result.flat();
  assertEquals(allRows.length, 10000);
  assertEquals(allRows[0], ["a0", "b0", "c0"]);
  assertEquals(allRows[9999], ["a9999", "b9999", "c9999"]);
});

Deno.test("Record pathological - 1MB field to LazyRow", async () => {
  const hugeField = randomString(1_000_000);
  const recordData = `small${FIELD_SEPARATOR}${hugeField}${FIELD_SEPARATOR}end${RECORD_SEPARATOR}`;
  
  const result = await enumerate([new TextEncoder().encode(recordData)])
    .transform(fromRecordToLazyRows())
    .collect();
  
  assertEquals(result[0][0].getField(0), "small");
  assertEquals(result[0][0].getField(1), hugeField);
  assertEquals(result[0][0].getField(2), "end");
});

Deno.test("Record pathological - 1MB field round-trip", async () => {
  const hugeField = randomString(1_000_000);
  const originalData = [["small", hugeField, "end"]];
  
  const recordBytes = await enumerate([originalData])
    .transform(toRecord())
    .collect();
  
  const parsedData = await enumerate(recordBytes)
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(parsedData[0][0][1], hugeField);
});

Deno.test("Record pathological - chunk boundary in middle of field", async () => {
  const field = "a".repeat(100);
  const recordData = `${field}${FIELD_SEPARATOR}${field}${RECORD_SEPARATOR}`;
  const bytes = new TextEncoder().encode(recordData);
  
  // Split in middle of first field
  const chunk1 = bytes.slice(0, 50);
  const chunk2 = bytes.slice(50);
  
  const result = await enumerate([chunk1, chunk2])
    .transform(fromRecordToRows())
    .collect();
  
  assertEquals(result[0][0][0], field);
  assertEquals(result[0][0][1], field);
});

Deno.test("Record pathological - many small chunks", async () => {
  const recordData = `a${FIELD_SEPARATOR}b${FIELD_SEPARATOR}c${RECORD_SEPARATOR}d${FIELD_SEPARATOR}e${FIELD_SEPARATOR}f${RECORD_SEPARATOR}`;
  const bytes = new TextEncoder().encode(recordData);
  
  // Split into 1-byte chunks
  const chunks = Array.from(bytes).map(b => new Uint8Array([b]));
  
  const result = await enumerate(chunks)
    .transform(fromRecordToRows())
    .collect();
  
  const allRows = result.flat();
  assertEquals(allRows.length, 2);
  assertEquals(allRows[0], ["a", "b", "c"]);
  assertEquals(allRows[1], ["d", "e", "f"]);
});
