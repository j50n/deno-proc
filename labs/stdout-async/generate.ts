#!/usr/bin/env -S deno run --allow-write

const PATTERN = "The quick brown fox jumps over the lazy dog. 0123456789\n";
const PATTERN_BYTES = new TextEncoder().encode(PATTERN);

async function generateFile(path: string, sizeBytes: number) {
  const file = await Deno.open(path, { write: true, create: true, truncate: true });
  
  let written = 0;
  while (written < sizeBytes) {
    const toWrite = Math.min(PATTERN_BYTES.length, sizeBytes - written);
    await file.write(PATTERN_BYTES.subarray(0, toWrite));
    written += toWrite;
  }
  
  file.close();
  console.log(`Generated ${path} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB)`);
}

const files = [
  { name: "data/small.txt", size: 1024 * 1024 },        // 1 MB
  { name: "data/medium.txt", size: 10 * 1024 * 1024 },  // 10 MB
  { name: "data/large.txt", size: 100 * 1024 * 1024 },  // 100 MB
];

for (const { name, size } of files) {
  await generateFile(name, size);
}

console.log("\nTest data generation complete!");
