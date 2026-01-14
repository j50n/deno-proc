import { assertEquals, assertThrows } from "jsr:@std/assert";
import { LazyRow } from "../../src/transforms/lazy-row.ts";

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

Deno.test("LazyRow - setField StringArray", async (t) => {
  await t.step("basic set operation", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(1, "modified");
    
    assertEquals(row.getField(0), "a");
    assertEquals(row.getField(1), "modified");
    assertEquals(row.getField(2), "c");
    assertEquals(row.toStringArray(), ["a", "modified", "c"]);
  });

  await t.step("set first field", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(0, "first");
    
    assertEquals(row.getField(0), "first");
    assertEquals(row.toStringArray(), ["first", "b", "c"]);
  });

  await t.step("set last field", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(2, "last");
    
    assertEquals(row.getField(2), "last");
    assertEquals(row.toStringArray(), ["a", "b", "last"]);
  });

  await t.step("set to empty string", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(1, "");
    
    assertEquals(row.getField(1), "");
    assertEquals(row.toStringArray(), ["a", "", "c"]);
  });

  await t.step("set UTF-8 content", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(1, "café 🚀");
    
    assertEquals(row.getField(1), "café 🚀");
  });

  await t.step("multiple sets", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c", "d"]);
    row.setField(0, "w");
    row.setField(2, "y");
    row.setField(3, "z");
    
    assertEquals(row.toStringArray(), ["w", "b", "y", "z"]);
  });

  await t.step("set same field multiple times", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    row.setField(1, "first");
    row.setField(1, "second");
    row.setField(1, "third");
    
    assertEquals(row.getField(1), "third");
  });

  await t.step("bounds checking", () => {
    const row = LazyRow.fromStringArray(["a", "b"]);
    
    assertThrows(() => row.setField(-1, "x"), RangeError);
    assertThrows(() => row.setField(2, "x"), RangeError);
    assertThrows(() => row.setField(10, "x"), RangeError);
  });

  await t.step("invalidates binary cache", () => {
    const row = LazyRow.fromStringArray(["a", "b", "c"]);
    const binary1 = row.toBinary();
    
    row.setField(1, "modified");
    const binary2 = row.toBinary();
    
    // Should be different binaries
    assertEquals(binary1 === binary2, false);
    
    // New binary should reflect changes
    const row2 = LazyRow.fromBinary(binary2);
    assertEquals(row2.getField(1), "modified");
  });
});

Deno.test("LazyRow - setField Binary", async (t) => {
  await t.step("basic set operation", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c"]).toBinary());
    row.setField(1, "modified");
    
    assertEquals(row.getField(0), "a");
    assertEquals(row.getField(1), "modified");
    assertEquals(row.getField(2), "c");
    assertEquals(row.toStringArray(), ["a", "modified", "c"]);
  });

  await t.step("modifications take precedence over binary", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c"]).toBinary());
    
    // Access field before modification
    assertEquals(row.getField(1), "b");
    
    // Modify it
    row.setField(1, "new");
    
    // Should return modified value
    assertEquals(row.getField(1), "new");
  });

  await t.step("unmodified fields still lazy", () => {
    const fields = Array.from({ length: 100 }, (_, i) => `field_${i}`);
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(fields).toBinary());
    
    // Modify one field
    row.setField(50, "modified");
    
    // Other fields should still work
    assertEquals(row.getField(0), "field_0");
    assertEquals(row.getField(50), "modified");
    assertEquals(row.getField(99), "field_99");
  });

  await t.step("multiple modifications", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c", "d", "e"]).toBinary());
    
    row.setField(0, "A");
    row.setField(2, "C");
    row.setField(4, "E");
    
    assertEquals(row.toStringArray(), ["A", "b", "C", "d", "E"]);
  });

  await t.step("overwrite same field", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c"]).toBinary());
    
    row.setField(1, "first");
    row.setField(1, "second");
    row.setField(1, "final");
    
    assertEquals(row.getField(1), "final");
  });

  await t.step("toBinary with no modifications returns original", () => {
    const original = LazyRow.fromStringArray(["a", "b", "c"]).toBinary();
    const row = LazyRow.fromBinary(original);
    
    // No modifications - should return same binary
    assertEquals(row.toBinary(), original);
  });

  await t.step("toBinary with modifications creates new binary", () => {
    const original = LazyRow.fromStringArray(["a", "b", "c"]).toBinary();
    const row = LazyRow.fromBinary(original);
    
    row.setField(1, "modified");
    const modified = row.toBinary();
    
    // Should be different
    assertEquals(modified === original, false);
    
    // New binary should have modifications
    const row2 = LazyRow.fromBinary(modified);
    assertEquals(row2.getField(1), "modified");
  });

  await t.step("invalidates string cache", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c"]).toBinary());
    
    // Build string cache
    const arr1 = row.toStringArray();
    assertEquals(arr1, ["a", "b", "c"]);
    
    // Modify
    row.setField(1, "new");
    
    // Should reflect changes
    const arr2 = row.toStringArray();
    assertEquals(arr2, ["a", "new", "c"]);
  });

  await t.step("bounds checking", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b"]).toBinary());
    
    assertThrows(() => row.setField(-1, "x"), RangeError);
    assertThrows(() => row.setField(2, "x"), RangeError);
    assertThrows(() => row.setField(10, "x"), RangeError);
  });

  await t.step("UTF-8 modifications", () => {
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(["a", "b", "c"]).toBinary());
    
    row.setField(0, "café");
    row.setField(1, "🚀");
    row.setField(2, "naïve");
    
    assertEquals(row.toStringArray(), ["café", "🚀", "naïve"]);
    
    // Round trip through binary
    const binary = row.toBinary();
    const row2 = LazyRow.fromBinary(binary);
    assertEquals(row2.toStringArray(), ["café", "🚀", "naïve"]);
  });
});

Deno.test("LazyRow - setField performance", async (t) => {
  await t.step("binary row - read-only performance unaffected", () => {
    const fields = Array.from({ length: 100 }, (_, i) => `field_${i}`);
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(fields).toBinary());
    
    // No modifications - getField should be fast
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      row.getField(i);
    }
    const end = performance.now();
    
    // Should be very fast (< 5ms for 100 fields)
    assertEquals(end - start < 5, true);
  });

  await t.step("binary row - sparse modifications efficient", () => {
    const fields = Array.from({ length: 10000 }, (_, i) => `field_${i}`);
    const row = LazyRow.fromBinary(LazyRow.fromStringArray(fields).toBinary());
    
    // Modify only 10 fields out of 10000
    const start = performance.now();
    for (let i = 0; i < 10; i++) {
      row.setField(i * 1000, "modified");
    }
    const end = performance.now();
    
    // Should be fast (< 1ms for 10 modifications)
    assertEquals(end - start < 1, true);
    
    // Verify modifications
    assertEquals(row.getField(0), "modified");
    assertEquals(row.getField(1000), "modified");
    assertEquals(row.getField(1), "field_1");
  });

  await t.step("binary row - toBinary fast path for no modifications", () => {
    const fields = Array.from({ length: 1000 }, (_, i) => `field_${i}`);
    const original = LazyRow.fromStringArray(fields).toBinary();
    const row = LazyRow.fromBinary(original);
    
    // No modifications - toBinary should be instant
    const start = performance.now();
    const binary = row.toBinary();
    const end = performance.now();
    
    assertEquals(binary, original);
    assertEquals(end - start < 0.1, true);
  });
});
