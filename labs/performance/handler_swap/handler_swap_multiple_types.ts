/**
 * Benchmark: Handler Swap with Multiple Type Checks
 * 
 * Real-world scenario: 4+ possible types, only one is actually used.
 * Can V8 reorder the if/else chain to put the hot path first?
 * Or does handler swap win by eliminating all checks after first iteration?
 */

class TypeA {
  constructor(public value: number) {}
}

class TypeB {
  constructor(public value: number) {}
}

class TypeC {
  constructor(public value: number) {}
}

class TypeD {
  constructor(public value: number) {}
}

function handleTypeA(item: TypeA): number {
  return item.value * 2;
}

function handleTypeB(item: TypeB): number {
  return item.value * 3;
}

function handleTypeC(item: TypeC): number {
  return item.value * 4;
}

function handleTypeD(item: TypeD): number {
  return item.value * 5;
}

// Handler swap: Check once, swap to correct handler
function processWithHandlerSwap(data: (TypeA | TypeB | TypeC | TypeD)[]): number {
  let sum = 0;
  let handler: (item: any) => number = (item: any) => {
    if (item instanceof TypeA) handler = handleTypeA;
    else if (item instanceof TypeB) handler = handleTypeB;
    else if (item instanceof TypeC) handler = handleTypeC;
    else if (item instanceof TypeD) handler = handleTypeD;
    return handler(item);
  };
  
  for (const item of data) {
    sum += handler(item);
  }
  return sum;
}

// Naive: Check all 4 types on every iteration
function processWithNaiveCheck(data: (TypeA | TypeB | TypeC | TypeD)[]): number {
  let sum = 0;
  for (const item of data) {
    if (item instanceof TypeA) {
      sum += handleTypeA(item);
    } else if (item instanceof TypeB) {
      sum += handleTypeB(item);
    } else if (item instanceof TypeC) {
      sum += handleTypeC(item);
    } else if (item instanceof TypeD) {
      sum += handleTypeD(item);
    }
  }
  return sum;
}

// Test with TypeD (last in the chain - worst case for naive)
const SIZE = 10_000_000;
const dataD = Array.from({ length: SIZE }, (_, i) => new TypeD(i));

Deno.bench({
  name: "Handler Swap - TypeD (4 checks)",
  group: "multiple_types",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataD);
  },
});

Deno.bench({
  name: "Naive Check - TypeD (4 checks)",
  group: "multiple_types",
  fn: () => {
    processWithNaiveCheck(dataD);
  },
});

// Also test with TypeA (first in chain - best case for naive)
const dataA = Array.from({ length: SIZE }, (_, i) => new TypeA(i));

Deno.bench({
  name: "Handler Swap - TypeA (4 checks)",
  group: "multiple_types_a",
  baseline: true,
  fn: () => {
    processWithHandlerSwap(dataA);
  },
});

Deno.bench({
  name: "Naive Check - TypeA (4 checks)",
  group: "multiple_types_a",
  fn: () => {
    processWithNaiveCheck(dataA);
  },
});
