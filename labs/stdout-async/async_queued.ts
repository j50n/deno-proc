#!/usr/bin/env -S deno run --allow-read

const CHUNK_SIZE = 64 * 1024; // 64KB chunks
const MAX_QUEUE_DEPTH = 4;

async function processFile(path: string) {
  const file = await Deno.open(path);
  const buffer = new Uint8Array(CHUNK_SIZE);
  
  const queue: Promise<void>[] = [];
  
  while (true) {
    const bytesRead = await file.read(buffer);
    if (bytesRead === null) break;
    
    const chunk = buffer.slice(0, bytesRead);
    const writePromise = Deno.stdout.write(chunk);
    queue.push(writePromise);
    
    if (queue.length >= MAX_QUEUE_DEPTH) {
      await queue.shift();
    }
  }
  
  await Promise.all(queue);
  file.close();
}

const filePath = Deno.args[0];
if (!filePath) {
  console.error("Usage: async_queued.ts <file>");
  Deno.exit(1);
}

await processFile(filePath);
