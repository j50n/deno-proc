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
