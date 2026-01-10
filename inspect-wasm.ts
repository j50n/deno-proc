#!/usr/bin/env -S deno run --allow-read

// Inspect WASM imports
const wasmBytes = await Deno.readFile("./wasm/flattext.wasm");

try {
  const wasmModule = await WebAssembly.compile(wasmBytes);
  const imports = WebAssembly.Module.imports(wasmModule);
  const exports = WebAssembly.Module.exports(wasmModule);
  
  console.log("=== WASM IMPORTS ===");
  for (const imp of imports) {
    console.log(`${imp.module}.${imp.name} (${imp.kind})`);
  }
  
  console.log("\n=== WASM EXPORTS ===");
  for (const exp of exports) {
    console.log(`${exp.name} (${exp.kind})`);
  }
} catch (error) {
  console.error("Error:", error);
}
