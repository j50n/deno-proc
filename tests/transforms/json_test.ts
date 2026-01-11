import { assertEquals, assertThrows } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromJsonToRows, fromJsonToLazyRows, toJson } from "../../src/transforms/json.ts";

Deno.test("JSON - basic parsing to RowData", async () => {
  const jsonlData = '{"name":"Alice","age":"30","city":"NYC"}\n{"name":"Bob","age":"25","city":"LA"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0], { name: "Alice", age: "30", city: "NYC" });
  assertEquals(result[0][1], { name: "Bob", age: "25", city: "LA" });
});

Deno.test("JSON - basic parsing to LazyRow", async () => {
  const jsonlData = '{"name":"Alice","age":"30"}\n{"name":"Bob","age":"25"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToLazyRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0].toStringArray(), ["Alice", "30"]);
  assertEquals(result[0][1].toStringArray(), ["Bob", "25"]);
});

Deno.test("JSON - chunked input", async () => {
  const chunks = ['{"name":"Alice"', ',"age":"30"}\n{"name":', '"Bob","age":"25"}'];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromJsonToRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0], { name: "Alice", age: "30" });
  assertEquals(result[0][1], { name: "Bob", age: "25" });
});

Deno.test("JSON - stringify from RowData", async () => {
  const data = [
    { name: "Alice", age: "30" },
    { name: "Bob", age: "25" }
  ];
  
  const result = await enumerate([data])
    .transform(toJson())
    .collect();
  
  const output = new TextDecoder().decode(result[0]);
  const lines = output.trim().split('\n');
  assertEquals(lines.length, 2);
  assertEquals(JSON.parse(lines[0]), { name: "Alice", age: "30" });
  assertEquals(JSON.parse(lines[1]), { name: "Bob", age: "25" });
});

Deno.test("JSON - round trip", async () => {
  const originalData = '{"name":"Alice","age":"30"}\n{"name":"Bob","age":"25"}';
  
  const parsed = await enumerate([new TextEncoder().encode(originalData)])
    .transform(fromJsonToRows())
    .collect();
  
  const stringified = await enumerate(parsed)
    .transform(toJson())
    .collect();
  
  const output = new TextDecoder().decode(stringified[0]).trim();
  const lines = output.split('\n');
  assertEquals(lines.length, 2);
  assertEquals(JSON.parse(lines[0]), { name: "Alice", age: "30" });
  assertEquals(JSON.parse(lines[1]), { name: "Bob", age: "25" });
});
