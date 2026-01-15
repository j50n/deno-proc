#!/usr/bin/env -S deno run --allow-read

/**
 * Verify that transformations produce correct TSV output
 */

import { enumerate } from "@j50n/proc";
import { Record2TsvWasmSimd } from "./record2tsv-wasm-simd.ts";

const wasmSimdTransformer = await Record2TsvWasmSimd.create();

async function* record2tsvWasmSimd(
  source: AsyncIterable<Uint8Array>,
): AsyncIterable<Uint8Array> {
  for await (const chunk of source) {
    yield wasmSimdTransformer.transform(chunk);
  }
}

// Read first 100 bytes of input
const inputFile = await Deno.open("data/small.record", { read: true });
const inputChunk = new Uint8Array(100);
await inputFile.read(inputChunk);
inputFile.close();

console.log("Input (first 100 bytes):");
console.log(new TextDecoder().decode(inputChunk));
console.log(
  "\nHex:",
  Array.from(inputChunk.slice(0, 50)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join(" "),
);

// Transform using WASM SIMD
const file = await Deno.open("data/small.record", { read: true });
const output: Uint8Array[] = [];

await enumerate(file.readable)
  .transform(record2tsvWasmSimd)
  .forEach((chunk) => {
    output.push(chunk);
  });

const result = new Uint8Array(
  output.reduce((acc, chunk) => acc + chunk.length, 0),
);
let offset = 0;
for (const chunk of output) {
  result.set(chunk, offset);
  offset += chunk.length;
}

console.log("\n\nOutput (first 100 bytes):");
console.log(new TextDecoder().decode(result.slice(0, 100)));
console.log(
  "\nHex:",
  Array.from(result.slice(0, 50)).map((b) => b.toString(16).padStart(2, "0"))
    .join(" "),
);

// Verify transformations
const inputSlice = inputChunk.slice(0, 50);
const outputSlice = result.slice(0, 50);

console.log("\n\nVerification:");
let errors = 0;
for (let i = 0; i < 50; i++) {
  if (inputSlice[i] === 0x1f && outputSlice[i] !== 0x09) {
    console.log(
      `❌ Position ${i}: Expected 0x1f → 0x09 (tab), got 0x${
        outputSlice[i].toString(16)
      }`,
    );
    errors++;
  } else if (inputSlice[i] === 0x1e && outputSlice[i] !== 0x0a) {
    console.log(
      `❌ Position ${i}: Expected 0x1e → 0x0a (newline), got 0x${
        outputSlice[i].toString(16)
      }`,
    );
    errors++;
  } else if (
    inputSlice[i] !== 0x1f && inputSlice[i] !== 0x1e &&
    inputSlice[i] !== outputSlice[i]
  ) {
    console.log(
      `❌ Position ${i}: Expected 0x${
        inputSlice[i].toString(16)
      } unchanged, got 0x${outputSlice[i].toString(16)}`,
    );
    errors++;
  }
}

if (errors === 0) {
  console.log("✅ All transformations correct!");
  console.log("   - 0x1f (field separator) → 0x09 (tab)");
  console.log("   - 0x1e (record separator) → 0x0a (newline)");
  console.log("   - All other bytes unchanged");
} else {
  console.log(`\n❌ Found ${errors} errors`);
}
