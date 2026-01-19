/**
 * Benchmark: Function Pointer Call Overhead
 * 
 * Does calling through a variable (handler(item)) have overhead vs direct call?
 * Test with increasing dataset sizes to see if V8 can optimize it away.
 */

class TypeA {
  constructor(public value: number) {}
}

function handleTypeA(item: TypeA): number {
  return item.value * 2;
}

// Handler swap (after swap completes, just calls through variable)
function processWithHandlerSwap(data: TypeA[]): number {
  let sum = 0;
  let handler: (item: any) => number = (item: any) => {
    handler = handleTypeA;
    return handler(item);
  };
  
  for (const item of data) {
    sum += handler(item);
  }
  return sum;
}

// Direct call (baseline - no indirection)
function processWithDirectCall(data: TypeA[]): number {
  let sum = 0;
  for (const item of data) {
    sum += handleTypeA(item);
  }
  return sum;
}

// Small dataset, iterate multiple times to test large total iterations
const CHUNK_SIZE = 100_000;
const data = Array.from({ length: CHUNK_SIZE }, (_, i) => new TypeA(i));

// Test different iteration counts
const iterations = [10, 100, 1000]; // 1M, 10M, 100M total items

for (const iters of iterations) {
  const totalItems = CHUNK_SIZE * iters;
  
  Deno.bench({
    name: `Handler Swap - ${(totalItems / 1_000_000).toFixed(0)}M items`,
    group: `iters_${iters}`,
    fn: () => {
      let sum = 0;
      for (let i = 0; i < iters; i++) {
        sum += processWithHandlerSwap(data);
      }
    },
  });
  
  Deno.bench({
    name: `Direct Call - ${(totalItems / 1_000_000).toFixed(0)}M items`,
    group: `iters_${iters}`,
    baseline: true,
    fn: () => {
      let sum = 0;
      for (let i = 0; i < iters; i++) {
        sum += processWithDirectCall(data);
      }
    },
  });
}
