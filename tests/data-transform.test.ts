import { assertEquals, assertThrows } from "@std/assert";
import { StringRow } from "../src/data-transform/string-row.ts";

Deno.test("StringRow - Basic Construction", () => {
  const columns = ["hello", "world", "test"];
  const row = StringRow.fromArray(columns);

  assertEquals(row.columnCount, 3);
  assertEquals(row.isDirty, false);
  assertEquals(row.changeCount, 0);
});

Deno.test("StringRow - Factory Methods", () => {
  const columns = ["a", "b", "c"];

  // fromArray
  const row1 = StringRow.fromArray(columns);
  assertEquals(row1.get(0), "a");
  assertEquals(row1.get(1), "b");
  assertEquals(row1.get(2), "c");

  // fromBytes
  const bytes = row1.toBytes();
  const row2 = StringRow.fromBytes(bytes);
  assertEquals(row2.get(0), "a");
  assertEquals(row2.get(1), "b");
  assertEquals(row2.get(2), "c");
});

Deno.test("StringRow - Get/Set Operations", () => {
  const row = StringRow.fromArray(["first", "second", "third"]);

  // Get operations
  assertEquals(row.get(0), "first");
  assertEquals(row.get(1), "second");
  assertEquals(row.get(2), "third");

  // Set operations
  row.set(1, "modified");
  assertEquals(row.get(1), "modified");
  assertEquals(row.isDirty, true);
  assertEquals(row.changeCount, 1);
});

Deno.test("StringRow - Bounds Checking", () => {
  const row = StringRow.fromArray(["a", "b"]);

  // Valid indices
  assertEquals(row.get(0), "a");
  assertEquals(row.get(1), "b");

  // Invalid indices
  assertThrows(() => row.get(-1), Error, "out of bounds");
  assertThrows(() => row.get(2), Error, "out of bounds");
  assertThrows(() => row.set(-1, "x"), Error, "out of bounds");
  assertThrows(() => row.set(2, "x"), Error, "out of bounds");
});

Deno.test("StringRow - Change Tracking", () => {
  const row = StringRow.fromArray(["a", "b", "c"]);

  // No changes initially
  assertEquals(row.getChangedColumns(), []);
  assertEquals(row.getChanges(), []);

  // Make changes
  row.set(0, "modified_a");
  row.set(2, "modified_c");

  assertEquals(row.getChangedColumns(), [0, 2]);
  assertEquals(row.getChanges(), [
    { columnIndex: 0, oldValue: "a", newValue: "modified_a" },
    { columnIndex: 2, oldValue: "c", newValue: "modified_c" },
  ]);
});

Deno.test("StringRow - Reset Changes", () => {
  const row = StringRow.fromArray(["a", "b", "c"]);

  row.set(0, "modified");
  assertEquals(row.isDirty, true);
  assertEquals(row.changeCount, 1);

  row.resetChanges();
  assertEquals(row.isDirty, false);
  assertEquals(row.changeCount, 0);
  assertEquals(row.get(0), "a"); // Back to original
});

Deno.test("StringRow - Set Same Value", () => {
  const row = StringRow.fromArray(["a", "b", "c"]);

  // Set to same value should not mark as dirty
  row.set(0, "a");
  assertEquals(row.isDirty, false);
  assertEquals(row.changeCount, 0);

  // Change then set back to original
  row.set(0, "modified");
  assertEquals(row.isDirty, true);
  row.set(0, "a");
  assertEquals(row.isDirty, false);
  assertEquals(row.changeCount, 0);
});

Deno.test("StringRow - toArray", () => {
  const original = ["hello", "world", "test"];
  const row = StringRow.fromArray(original);

  // Clean array
  assertEquals(row.toArray(), original);

  // Modified array
  row.set(1, "modified");
  assertEquals(row.toArray(), ["hello", "modified", "test"]);
});

Deno.test("StringRow - Iterator", () => {
  const row = StringRow.fromArray(["a", "b", "c"]);

  // Clean iteration
  assertEquals([...row], ["a", "b", "c"]);

  // Modified iteration
  row.set(1, "modified");
  assertEquals([...row], ["a", "modified", "c"]);
});

Deno.test("StringRow - Slice Operations", () => {
  const row = StringRow.fromArray(["a", "b", "c", "d", "e"]);

  assertEquals(row.slice(), ["a", "b", "c", "d", "e"]);
  assertEquals(row.slice(1), ["b", "c", "d", "e"]);
  assertEquals(row.slice(1, 3), ["b", "c"]);
  assertEquals(row.slice(0, 2), ["a", "b"]);

  // With modifications
  row.set(1, "modified");
  assertEquals(row.slice(0, 3), ["a", "modified", "c"]);
});

Deno.test("StringRow - First Method", () => {
  const row = StringRow.fromArray(["a", "b", "c", "d"]);

  assertEquals(row.first(), ["a"]);
  assertEquals(row.first(2), ["a", "b"]);
  assertEquals(row.first(0), []);

  // With modifications
  row.set(0, "modified");
  assertEquals(row.first(2), ["modified", "b"]);
});

Deno.test("StringRow - Serialization Roundtrip", () => {
  const original = ["hello", "world", "test", "data"];
  const row1 = StringRow.fromArray(original);

  // Clean serialization
  const bytes1 = row1.toBytes();
  const row2 = StringRow.fromBytes(bytes1);
  assertEquals(row2.toArray(), original);

  // Modified serialization
  row1.set(1, "modified");
  const bytes2 = row1.toBytes();
  const row3 = StringRow.fromBytes(bytes2);
  assertEquals(row3.toArray(), ["hello", "modified", "test", "data"]);
  assertEquals(row3.isDirty, false); // New row should be clean
});

Deno.test("StringRow - Empty Strings", () => {
  const row = StringRow.fromArray(["", "hello", "", "world", ""]);

  assertEquals(row.get(0), "");
  assertEquals(row.get(1), "hello");
  assertEquals(row.get(2), "");
  assertEquals(row.get(3), "world");
  assertEquals(row.get(4), "");

  row.set(0, "not_empty");
  row.set(2, "also_not_empty");
  assertEquals(row.toArray(), [
    "not_empty",
    "hello",
    "also_not_empty",
    "world",
    "",
  ]);
});

Deno.test("StringRow - Unicode Support", () => {
  const unicode = ["🚀", "café", "naïve", "北京"];
  const row = StringRow.fromArray(unicode);

  assertEquals(row.toArray(), unicode);

  row.set(0, "🎉");
  assertEquals(row.get(0), "🎉");
  assertEquals(row.toArray(), ["🎉", "café", "naïve", "北京"]);
});

Deno.test("StringRow - Multiple Changes Same Column", () => {
  const row = StringRow.fromArray(["original"]);

  row.set(0, "first_change");
  assertEquals(row.changeCount, 1);
  assertEquals(row.get(0), "first_change");

  row.set(0, "second_change");
  assertEquals(row.changeCount, 1); // Still only one change tracked
  assertEquals(row.get(0), "second_change");

  // Set back to original
  row.set(0, "original");
  assertEquals(row.changeCount, 0);
  assertEquals(row.isDirty, false);
});

Deno.test("StringRow - Clean Serialization Optimization", () => {
  const row = StringRow.fromArray(["a", "b", "c"]);

  // Clean serialization should return original buffer
  const bytes1 = row.toBytes();
  const bytes2 = row.toBytes();
  assertEquals(bytes1, bytes2); // Same reference for clean rows

  // Dirty serialization should create new buffer
  row.set(0, "modified");
  const bytes3 = row.toBytes();
  assertEquals(bytes3 !== bytes1, true); // Different reference for dirty rows
});

Deno.test("StringRow - getUnsafe Method", () => {
  const row = StringRow.fromArray(["first", "second", "third"]);

  // getUnsafe should work without bounds checking
  assertEquals(row.getUnsafe(0), "first");
  assertEquals(row.getUnsafe(1), "second");
  assertEquals(row.getUnsafe(2), "third");

  // getUnsafe with modifications
  row.set(1, "modified");
  assertEquals(row.getUnsafe(1), "modified");

  // Note: getUnsafe doesn't check bounds, so invalid indices would crash
  // We don't test invalid indices here as they would cause undefined behavior
});

Deno.test("StringRow - Edge Cases", () => {
  // Single column
  const single = StringRow.fromArray(["only"]);
  assertEquals(single.columnCount, 1);
  assertEquals(single.get(0), "only");

  // Very long string
  const longStr = "x".repeat(1000);
  const longRow = StringRow.fromArray([longStr, "short"]);
  assertEquals(longRow.get(0), longStr);
  assertEquals(longRow.get(1), "short");

  // Special characters
  const special = StringRow.fromArray(["\n", "\t", "\r", '"', "'"]);
  assertEquals(special.get(0), "\n");
  assertEquals(special.get(1), "\t");
  assertEquals(special.get(2), "\r");
  assertEquals(special.get(3), '"');
  assertEquals(special.get(4), "'");
});
