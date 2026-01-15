#!/usr/bin/env -S deno run --allow-read

const CHUNK_SIZE = 64 * 1024; // 64KB chunks

async function processFile(path: string) {
  const file = await Deno.open(path);
  const readable = file.readable;
  const writable = Deno.stdout.writable;
  
  await readable.pipeTo(writable, { preventClose: true });
}

const filePath = Deno.args[0];
if (!filePath) {
  console.error("Usage: async_buffered.ts <file>");
  Deno.exit(1);
}

await processFile(filePath);
