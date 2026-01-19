/**
 * Benchmark: Measuring Deoptimization Cost in Handler Swap Pattern
 * 
 * Tests handler swap at different dataset sizes to see:
 * 1. Is there a crossover point where handler swap becomes faster?
 * 2. What's the cost of the initial swap/deoptimization?
 * 3. At what size does the benefit outweigh the cost?
 */

class TypeA {
  constructor(public value: number) {}
}

class TypeB {
  constructor(public value: number) {}
}

function handleTypeA(item: TypeA): number {
  return item.value * 2;
}

function handleTypeB(item: TypeB): number {
  return item.value * 3;
}

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

// Test at different sizes to find crossover point
const sizes = [10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000];

for (const size of sizes) {
  const data = Array.from({ length: size }, (_, i) => new TypeA(i));
  
  Deno.bench({
    name: `Handler Swap - ${size.toLocaleString()} items`,
    group: `size_${size}`,
    baseline: true,
    fn: () => {
      processWithHandlerSwap(data);
    },
  });
  
  Deno.bench({
    name: `Naive Check - ${size.toLocaleString()} items`,
    group: `size_${size}`,
    fn: () => {
      processWithNaiveCheck(data);
    },
  });
}
