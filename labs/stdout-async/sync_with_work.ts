#!/usr/bin/env -S deno run --allow-read

const CHUNK_SIZE = 64 * 1024;

// Simulate CPU work (like data transformation)
function doWork(data: Uint8Array): Uint8Array {
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    sum += data[i];
  }
  return data; // Return unchanged, but we did work
}

async function processFile(path: string) {
  const file = await Deno.open(path);
  const buffer = new Uint8Array(CHUNK_SIZE);
  
  while (true) {
    const bytesRead = await file.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = buffer.subarray(0, bytesRead);
    const processed = doWork(chunk);
    Deno.stdout.writeSync(processed);
  }
  
  file.close();
}

const filePath = Deno.args[0];
if (!filePath) {
  console.error("Usage: sync_with_work.ts <file>");
  Deno.exit(1);
}

await processFile(filePath);
