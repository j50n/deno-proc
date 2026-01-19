/**
 * Benchmark: Type Check Primitives
 * 
 * Compare the raw performance of different type checking methods:
 * - typeof x === "string"
 * - instanceof
 * - Array.isArray()
 * - Compound checks (Array.isArray + length + instanceof)
 */

class LazyRow {
  constructor(public value: number) {}
  isBinaryBacked(): boolean {
    return false;
  }
}

const SIZE = 1_000_000;

// Test data
const strings = Array.from({ length: SIZE }, (_, i) => `string${i}`);
const objects = Array.from({ length: SIZE }, (_, i) => new LazyRow(i));
const arrays = Array.from({ length: SIZE }, (_, i) => [i, i + 1, i + 2]);
const lazyRowArrays = Array.from({ length: SIZE }, (_, i) => [new LazyRow(i)]);

// typeof string check
Deno.bench({
  name: "typeof === 'string'",
  group: "primitives",
  fn: () => {
    let count = 0;
    for (const item of strings) {
      if (typeof item === "string") count++;
    }
  },
});

// instanceof check
Deno.bench({
  name: "instanceof LazyRow",
  group: "primitives",
  fn: () => {
    let count = 0;
    for (const item of objects) {
      if (item instanceof LazyRow) count++;
    }
  },
});

// Array.isArray check
Deno.bench({
  name: "Array.isArray()",
  group: "primitives",
  fn: () => {
    let count = 0;
    for (const item of arrays) {
      if (Array.isArray(item)) count++;
    }
  },
});

// Compound: Array.isArray + length check
Deno.bench({
  name: "Array.isArray() + length > 0",
  group: "compound",
  fn: () => {
    let count = 0;
    for (const item of arrays) {
      if (Array.isArray(item) && item.length > 0) count++;
    }
  },
});

// Compound: Array.isArray + length + instanceof
Deno.bench({
  name: "Array.isArray() + length + instanceof",
  group: "compound",
  fn: () => {
    let count = 0;
    for (const item of lazyRowArrays) {
      if (Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow) {
        count++;
      }
    }
  },
});

// Compound: Full real-world check (binary LazyRow array)
Deno.bench({
  name: "Full check: Array + length + instanceof + method",
  group: "compound",
  fn: () => {
    let count = 0;
    for (const item of lazyRowArrays) {
      if (
        Array.isArray(item) && item.length > 0 &&
        item[0] instanceof LazyRow && item[0].isBinaryBacked()
      ) {
        count++;
      }
    }
  },
});
