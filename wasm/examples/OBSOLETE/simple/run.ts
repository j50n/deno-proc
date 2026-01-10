#!/usr/bin/env deno run --allow-read
// Simple streaming uppercase converter using WASM

const wasmBytes = await Deno.readFile("./uppercase.wasm");
const wasmModule = await WebAssembly.compile(wasmBytes);
const wasmInstance = await WebAssembly.instantiate(wasmModule);

const uppercase = wasmInstance.exports.uppercase as CallableFunction;
const memory = wasmInstance.exports.memory as WebAssembly.Memory;

// Process each chunk through WASM
for await (const chunk of Deno.stdin.readable) {
    const memView = new Uint8Array(memory.buffer);
    
    // Copy input to WASM memory
    memView.set(chunk, 0);
    
    // Call WASM function
    const outputLen = uppercase(0, chunk.length, chunk.length) as number;
    
    // Get result and write to stdout
    const result = memView.slice(chunk.length, chunk.length + outputLen);
    await Deno.stdout.write(result);
}
