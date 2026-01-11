import { assertEquals, assertThrows } from "@std/assert";
import { LazyRow } from "../../src/transforms/lazy_row.ts";

Deno.test("LazyRow - basic functionality", () => {
  const fields = ["Alice", "30", "Engineer"];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "Alice");
  assertEquals(row.getField(1), "30");
  assertEquals(row.getField(2), "Engineer");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - empty fields", () => {
  const fields = ["", "test", ""];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "");
  assertEquals(row.getField(1), "test");
  assertEquals(row.getField(2), "");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - single field", () => {
  const fields = ["single"];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 1);
  assertEquals(row.getField(0), "single");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - no fields", () => {
  const fields: string[] = [];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 0);
  assertEquals(row.toStringArray(), []);
});

Deno.test("LazyRow - UTF-8 handling", () => {
  const fields = ["🚀", "café", "naïve", "北京"];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 4);
  assertEquals(row.getField(0), "🚀");
  assertEquals(row.getField(1), "café");
  assertEquals(row.getField(2), "naïve");
  assertEquals(row.getField(3), "北京");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - multi-byte UTF-8 boundaries", () => {
  // Test characters that use different UTF-8 byte lengths
  const fields = [
    "A",           // 1 byte
    "é",           // 2 bytes (C3 A9)
    "€",           // 3 bytes (E2 82 AC)
    "𝕏",           // 4 bytes (F0 9D 95 8F)
    "🌟✨🎉",      // Multiple 4-byte emojis
    "混合text文字", // Mixed ASCII and multi-byte
  ];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 6);
  assertEquals(row.getField(0), "A");
  assertEquals(row.getField(1), "é");
  assertEquals(row.getField(2), "€");
  assertEquals(row.getField(3), "𝕏");
  assertEquals(row.getField(4), "🌟✨🎉");
  assertEquals(row.getField(5), "混合text文字");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - large fields", () => {
  const largeField = "x".repeat(10000);
  const fields = ["small", largeField, "tiny"];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "small");
  assertEquals(row.getField(1), largeField);
  assertEquals(row.getField(2), "tiny");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - field access bounds checking", () => {
  const fields = ["a", "b"];
  const row = LazyRow.fromStringArray(fields);
  
  assertThrows(() => row.getField(-1), Error, "out of range");
  assertThrows(() => row.getField(2), Error, "out of range");
  assertThrows(() => row.getField(100), Error, "out of range");
});

Deno.test("LazyRow - invalid data", () => {
  // Too short buffer
  assertThrows(() => new LazyRow(new Uint8Array([1, 2])), Error, "too short");
  
  // Empty buffer
  assertThrows(() => new LazyRow(new Uint8Array()), Error, "too short");
});

Deno.test("LazyRow - special characters", () => {
  const fields = ["line1\nline2", "tab\there", "quote\"test", "comma,test"];
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 4);
  assertEquals(row.getField(0), "line1\nline2");
  assertEquals(row.getField(1), "tab\there");
  assertEquals(row.getField(2), "quote\"test");
  assertEquals(row.getField(3), "comma,test");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - performance test", () => {
  // Test with many fields
  const fields = Array.from({ length: 100 }, (_, i) => `field_${i}_value`);
  const row = LazyRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 100);
  
  // Test random access (should be fast)
  assertEquals(row.getField(50), "field_50_value");
  assertEquals(row.getField(0), "field_0_value");
  assertEquals(row.getField(99), "field_99_value");
  
  // Test full conversion
  assertEquals(row.toStringArray(), fields);
});

Deno.test("LazyRow - lazy access advantage", () => {
  // Create a row with many large fields
  const fields = Array.from({ length: 50 }, (_, i) => `large_field_${i}_${"x".repeat(1000)}`);
  const row = LazyRow.fromStringArray(fields);
  
  // Access only a few fields - this should be efficient
  assertEquals(row.getField(0).startsWith("large_field_0_"), true);
  assertEquals(row.getField(25).startsWith("large_field_25_"), true);
  assertEquals(row.getField(49).startsWith("large_field_49_"), true);
  
  // Verify we can still get all if needed
  assertEquals(row.toStringArray().length, 50);
});
