const size = 10 * 1024 * 1024; // 10MB
const chunk = new Uint8Array(64 * 1024).fill(65);

const start = performance.now();
let written = 0;
while (written < size) {
  Deno.stdout.writeSync(chunk);
  written += chunk.length;
}
const duration = performance.now() - start;
const throughput = (size / 1024 / 1024) / (duration / 1000);
console.error(`\nThroughput: ${throughput.toFixed(2)} MB/s`);
