/**
 * Benchmark: Handler Swap vs Naive with Real Transform Pattern
 * 
 * Tests the actual csv.ts pattern with 7 different type paths.
 * Most complex check: Array.isArray + length + instanceof + isBinaryBacked()
 */

class LazyRow {
  constructor(public value: number, private binary: boolean = false) {}
  isBinaryBacked(): boolean {
    return this.binary;
  }
}

// Handlers for each type
function handleEmpty(): number { return 0; }
function handleBinaryLazyRowArray(items: LazyRow[]): number {
  return items.reduce((sum, item) => sum + item.value * 2, 0);
}
function handleStringLazyRowArray(items: LazyRow[]): number {
  return items.reduce((sum, item) => sum + item.value * 3, 0);
}
function handleBinaryLazyRow(item: LazyRow): number { return item.value * 4; }
function handleStringLazyRow(item: LazyRow): number { return item.value * 5; }
function handleRowArray(items: number[][]): number {
  return items.reduce((sum, row) => sum + row[0], 0);
}
function handleRow(items: number[]): number {
  return items.reduce((sum, n) => sum + n, 0);
}

// Handler swap pattern (real csv.ts logic)
function processWithHandlerSwap(data: any[]): number {
  let sum = 0;
  let handler: (item: any) => number = (item: any) => {
    if (Array.isArray(item) && item.length === 0) {
      return 0;
    }
    
    if (
      Array.isArray(item) && item.length > 0 &&
      item[0] instanceof LazyRow && item[0].isBinaryBacked()
    ) {
      handler = handleBinaryLazyRowArray;
    } else if (
      Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow
    ) {
      handler = handleStringLazyRowArray;
    } else if (item instanceof LazyRow && item.isBinaryBacked()) {
      handler = handleBinaryLazyRow;
    } else if (item instanceof LazyRow) {
      handler = handleStringLazyRow;
    } else if (
      Array.isArray(item) && item.length > 0 && Array.isArray(item[0])
    ) {
      handler = handleRowArray;
    } else if (Array.isArray(item)) {
      handler = handleRow;
    }
    
    return handler(item);
  };
  
  for (const item of data) {
    sum += handler(item);
  }
  return sum;
}

// Naive: Check all paths on every iteration
function processWithNaiveCheck(data: any[]): number {
  let sum = 0;
  for (const item of data) {
    if (Array.isArray(item) && item.length === 0) {
      sum += handleEmpty();
    } else if (
      Array.isArray(item) && item.length > 0 &&
      item[0] instanceof LazyRow && item[0].isBinaryBacked()
    ) {
      sum += handleBinaryLazyRowArray(item);
    } else if (
      Array.isArray(item) && item.length > 0 && item[0] instanceof LazyRow
    ) {
      sum += handleStringLazyRowArray(item);
    } else if (item instanceof LazyRow && item.isBinaryBacked()) {
      sum += handleBinaryLazyRow(item);
    } else if (item instanceof LazyRow) {
      sum += handleStringLazyRow(item);
    } else if (
      Array.isArray(item) && item.length > 0 && Array.isArray(item[0])
    ) {
      sum += handleRowArray(item);
    } else if (Array.isArray(item)) {
      sum += handleRow(item);
    }
  }
  return sum;
}

const SIZE = 1_000_000;

// Test each type path
const dataBinaryLazyRowArray = Array.from({ length: SIZE }, (_, i) => 
  [new LazyRow(i, true)]
);
const dataStringLazyRow = Array.from({ length: SIZE }, (_, i) => 
  new LazyRow(i, false)
);
const dataRowArray = Array.from({ length: SIZE }, (_, i) => 
  [[i, i + 1]]
);

Deno.bench({
  name: "Handler Swap - Binary LazyRow[] (worst case: 4 checks)",
  group: "binary_lazyrow_array",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataBinaryLazyRowArray);
  },
});

Deno.bench({
  name: "Naive Check - Binary LazyRow[] (worst case: 4 checks)",
  group: "binary_lazyrow_array",
  fn: () => {
    processWithNaiveCheck(dataBinaryLazyRowArray);
  },
});

Deno.bench({
  name: "Handler Swap - String LazyRow (middle: 2 checks)",
  group: "string_lazyrow",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataStringLazyRow);
  },
});

Deno.bench({
  name: "Naive Check - String LazyRow (middle: 2 checks)",
  group: "string_lazyrow",
  fn: () => {
    processWithNaiveCheck(dataStringLazyRow);
  },
});

Deno.bench({
  name: "Handler Swap - Row[][] (late: 3 checks)",
  group: "row_array",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataRowArray);
  },
});

Deno.bench({
  name: "Naive Check - Row[][] (late: 3 checks)",
  group: "row_array",
  fn: () => {
    processWithNaiveCheck(dataRowArray);
  },
});
