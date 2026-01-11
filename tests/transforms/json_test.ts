import { assertEquals, assertThrows } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromJsonBytes, fromJsonBytesToBinaryRow, toJsonBytes } from "../../src/transforms/json.ts";

Deno.test("JSON - basic parsing to RowData", async () => {
  const jsonlData = '{"name":"Alice","age":"30","city":"NYC"}\n{"name":"Bob","age":"25","city":"LA"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30", city: "NYC" },
      { name: "Bob", age: "25", city: "LA" }
    ]
  ]);
});

Deno.test("JSON - basic parsing to BinaryRow", async () => {
  const jsonlData = '{"name":"Alice","age":"30"}\n{"name":"Bob","age":"25"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytesToBinaryRow)
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0].toStringArray(), ["Alice", "30"]);
  assertEquals(result[0][1].toStringArray(), ["Bob", "25"]);
});

Deno.test("JSON - chunked input", async () => {
  const chunks = ['{"name":"Alice"}\n', '{"name":"Bob"}'];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice" },
      { name: "Bob" }
    ]
  ]);
});

Deno.test("JSON - mixed data types converted to strings", async () => {
  const jsonlData = '{"name":"Alice","age":30,"active":true,"score":95.5}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice", age: "30", active: "true", score: "95.5" }
    ]
  ]);
});

Deno.test("JSON - stringify from RowData", async () => {
  const data = [
    [
      { name: "Alice", age: "30" },
      { name: "Bob", age: "25" }
    ]
  ];
  
  const result = await enumerate(data)
    .transform(toJsonBytes)
    .collect();
  
  const jsonlText = new TextDecoder().decode(result[0]);
  const lines = jsonlText.trim().split('\n');
  assertEquals(JSON.parse(lines[0]), { name: "Alice", age: "30" });
  assertEquals(JSON.parse(lines[1]), { name: "Bob", age: "25" });
});

Deno.test("JSON - stringify from BinaryRow", async () => {
  const jsonlData = '{"name":"Alice","age":"30"}';
  
  // First parse to BinaryRow
  const binaryRows = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytesToBinaryRow)
    .collect();
  
  // Then stringify back
  const result = await enumerate(binaryRows)
    .transform(toJsonBytes)
    .collect();
  
  const jsonlText = new TextDecoder().decode(result[0]);
  const parsed = JSON.parse(jsonlText.trim());
  // Note: BinaryRow loses original keys, so we get field_0, field_1, etc.
  assertEquals(parsed, { field_0: "Alice", field_1: "30" });
});

Deno.test("JSON - empty lines ignored", async () => {
  const jsonlData = '{"name":"Alice"}\n\n{"name":"Bob"}\n\n';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "Alice" },
      { name: "Bob" }
    ]
  ]);
});

Deno.test("JSON - invalid JSON throws", async () => {
  const invalidJson = '{"name":"Alice"}\n{invalid json}\n{"name":"Bob"}';
  
  try {
    const result = enumerate([new TextEncoder().encode(invalidJson)])
      .transform(fromJsonBytes);
    
    // Consume the async generator to trigger the error
    for await (const batch of result) {
      // This should throw before we get here
    }
    
    // If we get here, the test should fail
    throw new Error("Expected SyntaxError to be thrown");
  } catch (error) {
    assertEquals(error instanceof SyntaxError, true);
  }
});

Deno.test("JSON - UTF-8 handling", async () => {
  const jsonlData = '{"name":"北京","city":"中国"}\n{"name":"Tokyo","city":"日本"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, [
    [
      { name: "北京", city: "中国" },
      { name: "Tokyo", city: "日本" }
    ]
  ]);
});

Deno.test("JSON - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromJsonBytes)
    .collect();
  
  assertEquals(result, []);
});
