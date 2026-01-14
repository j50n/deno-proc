import { assertEquals, assertThrows } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromJsonToRows, toJson } from "../../src/transforms/json.ts";

Deno.test("JSON - basic parsing to objects", async () => {
  const jsonlData = '{"name":"Alice","age":"30","city":"NYC"}\n{"name":"Bob","age":"25","city":"LA"}';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<{name: string, age: string, city: string}>())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0], { name: "Alice", age: "30", city: "NYC" });
  assertEquals(result[0][1], { name: "Bob", age: "25", city: "LA" });
});

Deno.test("JSON - arrays and primitives", async () => {
  const jsonlData = '[1,2,3]\n"hello"\n42\nnull';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 4);
  assertEquals(result[0][0], [1, 2, 3]);
  assertEquals(result[0][1], "hello");
  assertEquals(result[0][2], 42);
  assertEquals(result[0][3], null);
});

Deno.test("JSON - chunked input", async () => {
  const chunks = ['{"name":"Alice"', ',"age":"30"}\n{"name":', '"Bob","age":"25"}'];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromJsonToRows<{name: string, age: string}>())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 2);
  assertEquals(result[0][0], { name: "Alice", age: "30" });
  assertEquals(result[0][1], { name: "Bob", age: "25" });
});

Deno.test("JSON - stringify objects", async () => {
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

// =============================================================================
// Additional Tests
// =============================================================================

Deno.test("JSON - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromJsonToRows())
    .collect();
  
  assertEquals(result, []);
});

Deno.test("JSON - multi-byte UTF-8", async () => {
  const jsonlData = '{"city":"北京","emoji":"🏙️"}\n';
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<{city: string, emoji: string}>())
    .collect();
  
  assertEquals(result[0][0].city, "北京");
  assertEquals(result[0][0].emoji, "🏙️");
});

Deno.test("JSON - invalid JSON throws", async () => {
  const jsonlData = '{"invalid": json}\n';
  
  try {
    const result = enumerate([new TextEncoder().encode(jsonlData)])
      .transform(fromJsonToRows());
    for await (const batch of result) {
      // Should throw
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(error instanceof SyntaxError, true);
  }
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

Deno.test("JSON pathological - large object (100 keys)", async () => {
  const obj: Record<string, string> = {};
  for (let i = 0; i < 100; i++) {
    obj[`key${i}`] = `value${i}`;
  }
  const jsonlData = JSON.stringify(obj) + "\n";
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<Record<string, string>>())
    .collect();
  
  assertEquals(Object.keys(result[0][0]).length, 100);
  assertEquals(result[0][0].key0, "value0");
  assertEquals(result[0][0].key99, "value99");
});

Deno.test("JSON pathological - many items (10000 objects)", async () => {
  const lines = Array.from({ length: 10000 }, (_, i) => 
    JSON.stringify({ id: i, name: `item${i}` })
  );
  const jsonlData = lines.join("\n") + "\n";
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<{id: number, name: string}>())
    .collect();
  
  const allItems = result.flat();
  assertEquals(allItems.length, 10000);
  assertEquals(allItems[0].id, 0);
  assertEquals(allItems[9999].id, 9999);
});

Deno.test("JSON pathological - deeply nested object", async () => {
  // Create 50 levels of nesting
  let obj: Record<string, unknown> = { value: "deep" };
  for (let i = 0; i < 50; i++) {
    obj = { nested: obj };
  }
  const jsonlData = JSON.stringify(obj) + "\n";
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows())
    .collect();
  
  // Navigate to the deepest value
  let current: unknown = result[0][0];
  for (let i = 0; i < 50; i++) {
    current = (current as Record<string, unknown>).nested;
  }
  assertEquals((current as Record<string, string>).value, "deep");
});

Deno.test("JSON pathological - large string value (1MB)", async () => {
  const hugeValue = randomString(1_000_000);
  const jsonlData = JSON.stringify({ data: hugeValue }) + "\n";
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<{data: string}>())
    .collect();
  
  assertEquals(result[0][0].data, hugeValue);
});

Deno.test("JSON pathological - large array (10000 elements)", async () => {
  const arr = Array.from({ length: 10000 }, (_, i) => i);
  const jsonlData = JSON.stringify(arr) + "\n";
  
  const result = await enumerate([new TextEncoder().encode(jsonlData)])
    .transform(fromJsonToRows<number[]>())
    .collect();
  
  assertEquals(result[0][0].length, 10000);
  assertEquals(result[0][0][0], 0);
  assertEquals(result[0][0][9999], 9999);
});

Deno.test("JSON pathological - round-trip with large data", async () => {
  const hugeValue = randomString(100_000);
  const originalData = [
    { id: 1, data: hugeValue },
    { id: 2, data: hugeValue }
  ];
  
  const jsonBytes = await enumerate([originalData])
    .transform(toJson())
    .collect();
  
  const parsedData = await enumerate(jsonBytes)
    .transform(fromJsonToRows<{id: number, data: string}>())
    .collect();
  
  assertEquals(parsedData[0][0].data, hugeValue);
  assertEquals(parsedData[0][1].data, hugeValue);
});

Deno.test("JSON pathological - chunk boundary in middle of string", async () => {
  const jsonlData = '{"name":"Alice","city":"NYC"}\n{"name":"Bob","city":"LA"}\n';
  const bytes = new TextEncoder().encode(jsonlData);
  
  // Split in middle of a string value
  const chunk1 = bytes.slice(0, 15);
  const chunk2 = bytes.slice(15);
  
  const result = await enumerate([chunk1, chunk2])
    .transform(fromJsonToRows<{name: string, city: string}>())
    .collect();
  
  assertEquals(result.flat().length, 2);
  assertEquals(result.flat()[0].name, "Alice");
  assertEquals(result.flat()[1].name, "Bob");
});

Deno.test("JSON pathological - many small chunks", async () => {
  const jsonlData = '{"a":1}\n{"b":2}\n{"c":3}\n';
  const bytes = new TextEncoder().encode(jsonlData);
  
  // Split into 1-byte chunks
  const chunks = Array.from(bytes).map(b => new Uint8Array([b]));
  
  const result = await enumerate(chunks)
    .transform(fromJsonToRows())
    .collect();
  
  const allItems = result.flat();
  assertEquals(allItems.length, 3);
});
