// Test if stdout is buffered by writing small chunks and timing

const start = performance.now();

// Write 1000 tiny chunks (1 byte each)
for (let i = 0; i < 1000; i++) {
  Deno.stdout.writeSync(new Uint8Array([65])); // 'A'
}

const duration = performance.now() - start;
console.error(`\n1000 x 1-byte writes: ${duration.toFixed(2)}ms`);

// Now write same data in one chunk
const start2 = performance.now();
const bigChunk = new Uint8Array(1000).fill(65);
Deno.stdout.writeSync(bigChunk);
const duration2 = performance.now() - start2;
console.error(`1 x 1000-byte write: ${duration2.toFixed(2)}ms`);
console.error(`Ratio: ${(duration / duration2).toFixed(1)}x`);
