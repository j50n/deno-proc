/**
 * Benchmark: Handler Swap Goldilocks Case
 * 
 * Test if handler swap is worth it when there's only ONE type to check.
 * This is the simplest case - does the swap overhead kill the benefit?
 */

class TypeA {
  constructor(public value: number) {}
}

function handleTypeA(item: TypeA): number {
  return item.value * 2;
}

// Handler swap with single type check
function processWithHandlerSwap(data: TypeA[]): number {
  let sum = 0;
  let handler: (item: any) => number = (item: any) => {
    if (item instanceof TypeA) handler = handleTypeA;
    return handler(item);
  };
  
  for (const item of data) {
    sum += handler(item);
  }
  return sum;
}

// Naive: Check on every iteration
function processWithNaiveCheck(data: TypeA[]): number {
  let sum = 0;
  for (const item of data) {
    if (item instanceof TypeA) {
      sum += handleTypeA(item);
    }
  }
  return sum;
}

// Direct call: No type check at all (baseline)
function processWithDirectCall(data: TypeA[]): number {
  let sum = 0;
  for (const item of data) {
    sum += handleTypeA(item);
  }
  return sum;
}

const SIZE = 10_000_000;
const data = Array.from({ length: SIZE }, (_, i) => new TypeA(i));

Deno.bench({
  name: "Handler Swap - Single type check",
  group: "goldilocks",
  fn: () => {
    processWithHandlerSwap(data);
  },
});

Deno.bench({
  name: "Naive Check - Single type check",
  group: "goldilocks",
  fn: () => {
    processWithNaiveCheck(data);
  },
});

Deno.bench({
  name: "Direct Call - No type check (baseline)",
  group: "goldilocks",
  baseline: true,
  fn: () => {
    processWithDirectCall(data);
  },
});
