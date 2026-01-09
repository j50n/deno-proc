#!/usr/bin/env -S deno run --allow-read

/**
 * Out-of-process CSV parser using proper proc streaming pattern
 */

import { parse } from "@std/csv";
import { enumerate, concat } from "@j50n/proc";
import { StringRow } from "../../../../src/data-transform/string-row.ts";

const BATCH_SIZE = 1000;

// Transform CSV text to parsed rows
async function* csvParser(chunks: AsyncIterable<Uint8Array>) {
  const allData = [];
  
  for await (const chunk of chunks) {
    allData.push(chunk);
  }
  
  const text = new TextDecoder().decode(concat(allData));
  const rows = parse(text);
  
  for (const row of rows) {
    yield row;
  }
}

// Batch rows into arrays
async function* batcher(rows: AsyncIterable<string[]>) {
  let batch: string[][] = [];
  
  for await (const row of rows) {
    batch.push(row);
    
    if (batch.length >= BATCH_SIZE) {
      yield batch;
      batch = [];
    }
  }
  
  if (batch.length > 0) {
    yield batch;
  }
}

async function main() {
  await enumerate(Deno.stdin.readable)
    .transform(csvParser)
    .transform(batcher)
    .forEach(async (rowBatch) => {
      // Serialize each row with length prefix
      const chunks: Uint8Array[] = [];
      
      for (const row of rowBatch) {
        const stringRowBytes = StringRow.fromArray(row).toBytes();
        
        // Write length prefix (4 bytes) + StringRow data
        const lengthBytes = new Uint8Array(4);
        new DataView(lengthBytes.buffer).setUint32(0, stringRowBytes.length, true);
        
        chunks.push(lengthBytes);
        chunks.push(stringRowBytes);
      }
      
      const output = concat(chunks);
      await Deno.stdout.write(output);
    });
}

if (import.meta.main) {
  main().catch(console.error);
}
