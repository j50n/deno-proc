import { assertEquals, assertThrows } from "jsr:@std/assert";
import { LazyRow } from "../../src/transforms/lazy_row.ts";

Deno.test("LazyRow - StringArray implementation", async (t) => {
  await t.step("basic functionality", () => {
    const fields = ["hello", "world", "test"];
    const row = LazyRow.fromStringArray(fields);
    
    assertEquals(row.columnCount, 3);
    assertEquals(row.getField(0), "hello");
    assertEquals(row.getField(1), "world");
    assertEquals(row.getField(2), "test");
    assertEquals(row.toStringArray(), ["hello", "world", "test"]);
  });

  await t.step("empty fields", () => {
    const fields = ["", "test", ""];
    const row = LazyRow.fromStringArray(fields);
    
    assertEquals(row.columnCount, 3);
    assertEquals(row.getField(0), "");
    assertEquals(row.getField(1), "test");
    assertEquals(row.getField(2), "");
  });

  await t.step("single field", () => {
    const fields = ["single"];
    const row = LazyRow.fromStringArray(fields);
    
    assertEquals(row.columnCount, 1);
    assertEquals(row.getField(0), "single");
  });

  await t.step("no fields", () => {
    const fields: string[] = [];
    const row = LazyRow.fromStringArray(fields);
    
    assertEquals(row.columnCount, 0);
    assertEquals(row.toStringArray(), []);
  });

  await t.step("field access bounds checking", () => {
    const fields = ["a", "b"];
    const row = LazyRow.fromStringArray(fields);
    
    assertThrows(() => row.getField(-1), RangeError);
    assertThrows(() => row.getField(2), RangeError);
    assertThrows(() => row.getField(10), RangeError);
  });

  await t.step("UTF-8 handling", () => {
    const fields = ["café", "naïve", "🚀"];
    const row = LazyRow.fromStringArray(fields);
    
    assertEquals(row.getField(0), "café");
    assertEquals(row.getField(1), "naïve");
    assertEquals(row.getField(2), "🚀");
  });

  await t.step("binary conversion and caching", () => {
    const fields = ["a", "bb", "ccc"];
    const row = LazyRow.fromStringArray(fields);
    
    const binary1 = row.toBinary();
    const binary2 = row.toBinary();
    
    // Should return the same cached instance
    assertEquals(binary1, binary2);
    
    // Should be able to recreate from binary
    const row2 = LazyRow.fromBinary(binary1);
    assertEquals(row2.columnCount, 3);
    assertEquals(row2.getField(0), "a");
    assertEquals(row2.getField(1), "bb");
    assertEquals(row2.getField(2), "ccc");
  });
});

Deno.test("LazyRow - Binary implementation", async (t) => {
  await t.step("round trip conversion", () => {
    const originalFields = ["hello", "world", "test", ""];
    const stringRow = LazyRow.fromStringArray(originalFields);
    const binary = stringRow.toBinary();
    
    const binaryRow = LazyRow.fromBinary(binary);
    assertEquals(binaryRow.columnCount, 4);
    assertEquals(binaryRow.getField(0), "hello");
    assertEquals(binaryRow.getField(1), "world");
    assertEquals(binaryRow.getField(2), "test");
    assertEquals(binaryRow.getField(3), "");
    assertEquals(binaryRow.toStringArray(), originalFields);
  });

  await t.step("lazy field parsing", () => {
    const fields = ["a", "b", "c", "d", "e"];
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    // Access only some fields
    assertEquals(binaryRow.getField(1), "b");
    assertEquals(binaryRow.getField(3), "d");
    
    // Full array should still work
    assertEquals(binaryRow.toStringArray(), fields);
  });

  await t.step("field caching", () => {
    const fields = ["test1", "test2", "test3"];
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    // First access should parse and cache
    const field1a = binaryRow.getField(1);
    const field1b = binaryRow.getField(1);
    
    assertEquals(field1a, "test2");
    assertEquals(field1b, "test2");
  });

  await t.step("string array caching", () => {
    const fields = ["a", "b", "c"];
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    const array1 = binaryRow.toStringArray();
    const array2 = binaryRow.toStringArray();
    
    assertEquals(array1, fields);
    assertEquals(array2, fields);
    // Should return different arrays (defensive copy)
    assertEquals(array1 !== array2, true);
  });

  await t.step("binary passthrough", () => {
    const fields = ["test"];
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    // toBinary should return the original data
    assertEquals(binaryRow.toBinary(), binary);
  });

  await t.step("UTF-8 multi-byte handling", () => {
    const fields = ["café", "🚀", "naïve"];
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    assertEquals(binaryRow.getField(0), "café");
    assertEquals(binaryRow.getField(1), "🚀");
    assertEquals(binaryRow.getField(2), "naïve");
  });
});

Deno.test("LazyRow - Polymorphism", async (t) => {
  await t.step("instanceof works", () => {
    const stringRow = LazyRow.fromStringArray(["a", "b"]);
    const binaryRow = LazyRow.fromBinary(stringRow.toBinary());
    
    assertEquals(stringRow instanceof LazyRow, true);
    assertEquals(binaryRow instanceof LazyRow, true);
  });

  await t.step("polymorphic usage", () => {
    function processRow(row: LazyRow): string {
      return `${row.columnCount} fields: ${row.getField(0)}`;
    }
    
    const stringRow = LazyRow.fromStringArray(["hello", "world"]);
    const binaryRow = LazyRow.fromBinary(stringRow.toBinary());
    
    assertEquals(processRow(stringRow), "2 fields: hello");
    assertEquals(processRow(binaryRow), "2 fields: hello");
  });

  await t.step("array of mixed implementations", () => {
    const stringRow = LazyRow.fromStringArray(["a", "b"]);
    const binaryRow = LazyRow.fromBinary(stringRow.toBinary());
    
    const rows: LazyRow[] = [stringRow, binaryRow];
    
    for (const row of rows) {
      assertEquals(row.columnCount, 2);
      assertEquals(row.getField(0), "a");
      assertEquals(row.getField(1), "b");
    }
  });
});

Deno.test("LazyRow - Performance characteristics", async (t) => {
  await t.step("string array - no conversion cost", () => {
    const fields = Array.from({ length: 1000 }, (_, i) => `field_${i}`);
    
    const start = performance.now();
    const row = LazyRow.fromStringArray(fields);
    const end = performance.now();
    
    // Should be very fast (< 1ms for 1000 fields)
    assertEquals(end - start < 1, true);
    assertEquals(row.columnCount, 1000);
  });

  await t.step("binary - lazy field access", () => {
    const fields = Array.from({ length: 100 }, (_, i) => `field_${i}_with_longer_content`);
    const stringRow = LazyRow.fromStringArray(fields);
    const binary = stringRow.toBinary();
    const binaryRow = LazyRow.fromBinary(binary);
    
    // Accessing just one field should be fast
    const start = performance.now();
    const field = binaryRow.getField(50);
    const end = performance.now();
    
    assertEquals(field, "field_50_with_longer_content");
    // Should be faster than parsing all fields
    assertEquals(end - start < 1, true);
  });
});
