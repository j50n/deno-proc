#!/usr/bin/env -S deno run --allow-read --allow-write

const wasmBytes = await Deno.readFile("./counter.wasm");
const wasmModule = new WebAssembly.Module(wasmBytes);
const wasmInstance = new WebAssembly.Instance(wasmModule, {
  odin_env: {
    rand_bytes: () => 0,
    write: () => 0,
    trap: () => { throw new Error("WASM trap"); },
  }
});

const { process_bytes, memory } = wasmInstance.exports as {
  process_bytes: (length: number) => number;
  memory: WebAssembly.Memory;
};

// Get direct access to WASM memory once
const wasmMemory = new Uint8Array(memory.buffer);

function processAndGetStringsUTF16(data: Uint8Array): string[] {
  // Copy input data to WASM memory at offset 0
  wasmMemory.set(data, 0);
  
  // Call WASM function - returns offset where string data starts
  const resultOffset = process_bytes(data.length);
  
  // Parse serialized UTF-16 strings from WASM memory
  const view = new DataView(memory.buffer);
  let pos = resultOffset;
  
  // Read number of strings
  const numStrings = view.getUint32(pos, true); // little-endian
  pos += 4;
  
  const strings: string[] = [];
  
  // Read each UTF-16 string
  for (let i = 0; i < numStrings; i++) {
    // Read string length in bytes
    const strLenBytes = view.getUint32(pos, true);
    pos += 4;
    
    // Read UTF-16 data directly
    const utf16Bytes = wasmMemory.slice(pos, pos + strLenBytes);
    const str = new TextDecoder('utf-16le').decode(utf16Bytes);
    strings.push(str);
    pos += strLenBytes;
  }
  
  return strings;
}

// Test with sample data
const testData = new Uint8Array([1, 2, 3, 4, 5]);
console.log(`Input data: [${testData.join(', ')}]`);

// Time the UTF-16 approach
const start = performance.now();
const result = processAndGetStringsUTF16(testData);
const end = performance.now();

console.log(`Returned strings (UTF-16):`, result);
console.log(`Time taken: ${(end - start).toFixed(3)}ms`);
