/**
 * Benchmark: Handler Swap Pattern vs Naive Type Checking
 * 
 * Tests the performance difference between:
 * 1. Handler swap: Check type once, swap function pointer, no further checks
 * 2. Naive if/else: Check type on every iteration
 * 3. Boolean flag: Check type once, set flag, check flag every iteration
 */

// Simulate two different data types
class TypeA {
  constructor(public value: number) {}
}

class TypeB {
  constructor(public value: number) {}
}

// Handlers for each type
function handleTypeA(item: TypeA): number {
  return item.value * 2;
}

function handleTypeB(item: TypeB): number {
  return item.value * 3;
}

// Strategy 1: Handler Swap Pattern (what we use)
function processWithHandlerSwap(data: (TypeA | TypeB)[]): number {
  let sum = 0;
  let handler: (item: any) => number = (item: any) => {
    if (item instanceof TypeA) handler = handleTypeA;
    else if (item instanceof TypeB) handler = handleTypeB;
    return handler(item);
  };
  
  for (const item of data) {
    sum += handler(item);
  }
  return sum;
}

// Strategy 2: Naive if/else on every iteration
function processWithNaiveCheck(data: (TypeA | TypeB)[]): number {
  let sum = 0;
  for (const item of data) {
    if (item instanceof TypeA) {
      sum += handleTypeA(item);
    } else if (item instanceof TypeB) {
      sum += handleTypeB(item);
    }
  }
  return sum;
}

// Strategy 3: Boolean flag (check once, then check flag every iteration)
function processWithFlag(data: (TypeA | TypeB)[]): number {
  let sum = 0;
  let isTypeA: boolean | null = null;
  
  for (const item of data) {
    if (isTypeA === null) {
      isTypeA = item instanceof TypeA;
    }
    
    if (isTypeA) {
      sum += handleTypeA(item as TypeA);
    } else {
      sum += handleTypeB(item as TypeB);
    }
  }
  return sum;
}

// Generate test data - all same type (TypeScript's guarantee)
const SIZE = 10_000_000;
const dataA = Array.from({ length: SIZE }, (_, i) => new TypeA(i));
const dataB = Array.from({ length: SIZE }, (_, i) => new TypeB(i));

Deno.bench({
  name: "Handler Swap - TypeA",
  group: "TypeA",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataA);
  },
});

Deno.bench({
  name: "Naive Check - TypeA",
  group: "TypeA",
  fn: () => {
    processWithNaiveCheck(dataA);
  },
});

Deno.bench({
  name: "Boolean Flag - TypeA",
  group: "TypeA",
  fn: () => {
    processWithFlag(dataA);
  },
});

Deno.bench({
  name: "Handler Swap - TypeB",
  group: "TypeB",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataB);
  },
});

Deno.bench({
  name: "Naive Check - TypeB",
  group: "TypeB",
  fn: () => {
    processWithNaiveCheck(dataB);
  },
});

Deno.bench({
  name: "Boolean Flag - TypeB",
  group: "TypeB",
  fn: () => {
    processWithFlag(dataB);
  },
});
