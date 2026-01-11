import { assertEquals, assertThrows } from "@std/assert";
import { BinaryRow } from "../../src/transforms/binary_row.ts";

Deno.test("BinaryRow - basic functionality", () => {
  const fields = ["Alice", "30", "Engineer"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "Alice");
  assertEquals(row.getField(1), "30");
  assertEquals(row.getField(2), "Engineer");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - empty fields", () => {
  const fields = ["", "test", ""];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "");
  assertEquals(row.getField(1), "test");
  assertEquals(row.getField(2), "");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - single field", () => {
  const fields = ["single"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 1);
  assertEquals(row.getField(0), "single");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - no fields", () => {
  const fields: string[] = [];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 0);
  assertEquals(row.toStringArray(), []);
});

Deno.test("BinaryRow - UTF-8 handling", () => {
  const fields = ["🚀", "café", "naïve", "北京"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 4);
  assertEquals(row.getField(0), "🚀");
  assertEquals(row.getField(1), "café");
  assertEquals(row.getField(2), "naïve");
  assertEquals(row.getField(3), "北京");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - large fields", () => {
  const largeField = "x".repeat(10000);
  const fields = ["small", largeField, "tiny"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 3);
  assertEquals(row.getField(0), "small");
  assertEquals(row.getField(1), largeField);
  assertEquals(row.getField(2), "tiny");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - field access bounds checking", () => {
  const fields = ["a", "b"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertThrows(() => row.getField(-1), Error, "out of range");
  assertThrows(() => row.getField(2), Error, "out of range");
  assertThrows(() => row.getField(100), Error, "out of range");
});

Deno.test("BinaryRow - invalid data", () => {
  // Too short buffer
  assertThrows(() => new BinaryRow(new Uint8Array([1, 2])), Error, "too short");
  
  // Empty buffer
  assertThrows(() => new BinaryRow(new Uint8Array()), Error, "too short");
});

Deno.test("BinaryRow - special characters", () => {
  const fields = ["line1\nline2", "tab\there", "quote\"test", "comma,test"];
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 4);
  assertEquals(row.getField(0), "line1\nline2");
  assertEquals(row.getField(1), "tab\there");
  assertEquals(row.getField(2), "quote\"test");
  assertEquals(row.getField(3), "comma,test");
  assertEquals(row.toStringArray(), fields);
});

Deno.test("BinaryRow - performance test", () => {
  // Test with many fields
  const fields = Array.from({ length: 100 }, (_, i) => `field_${i}_value`);
  const row = BinaryRow.fromStringArray(fields);
  
  assertEquals(row.columnCount, 100);
  
  // Test random access (should be fast)
  assertEquals(row.getField(50), "field_50_value");
  assertEquals(row.getField(0), "field_0_value");
  assertEquals(row.getField(99), "field_99_value");
  
  // Test full conversion
  assertEquals(row.toStringArray(), fields);
});
