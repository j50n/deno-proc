#!/usr/bin/env -S deno run --allow-read

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

async function processFile(path: string) {
  const file = await Deno.open(path);
  const buffer = new Uint8Array(CHUNK_SIZE);
  
  while (true) {
    const bytesRead = await file.read(buffer);
    if (bytesRead === null) break;
    
    Deno.stdout.writeSync(buffer.subarray(0, bytesRead));
  }
  
  file.close();
}

const filePath = Deno.args[0];
if (!filePath) {
  console.error("Usage: sync.ts <file>");
  Deno.exit(1);
}

await processFile(filePath);
