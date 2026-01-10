export class DynamicLineProcessor {
  private wasmInstance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;

  constructor(wasmInstance: WebAssembly.Instance) {
    this.wasmInstance = wasmInstance;
    this.memory = wasmInstance.exports.memory as WebAssembly.Memory;
    
    // Initialize WASM memory with the full buffer
    const memorySize = this.memory.buffer.byteLength;
    (this.wasmInstance.exports.init_memory as Function)(0, memorySize);
  }

  getHeapUsage(): number {
    return (this.wasmInstance.exports.get_heap_usage as Function)();
  }

  getMemorySize(): number {
    return this.memory.buffer.byteLength;
  }

  processChunk(data: Uint8Array): Uint8Array[] {
    const memView = new Uint8Array(this.memory.buffer);
    
    // Copy input data to WASM memory (we'll let WASM manage its own input buffer)
    let inputPtr = 0;
    if (data.length > 0) {
      memView.set(data, inputPtr);
    }

    // Process the chunk
    const outputPtr = (this.wasmInstance.exports.process_lines_dynamic as Function)(inputPtr, data.length);
    const outputSize = (this.wasmInstance.exports.get_output_size as Function)();
    
    if (outputSize === 0) {
      return [];
    }

    // Extract lines from output
    const lines: Uint8Array[] = [];
    let pos = outputPtr;
    const endPos = outputPtr + outputSize;
    
    while (pos < endPos) {
      // Read 32-bit length (little-endian)
      const lengthView = new DataView(this.memory.buffer, pos, 4);
      const length = lengthView.getUint32(0, true);
      pos += 4;
      
      // Read line data
      const lineData = memView.slice(pos, pos + length);
      lines.push(new Uint8Array(lineData));
      pos += length;
    }
    
    return lines;
  }

  flushLeftover(): Uint8Array[] {
    const outputPtr = (this.wasmInstance.exports.flush_leftover as Function)();
    if (outputPtr === 0) {
      return [];
    }

    const outputSize = (this.wasmInstance.exports.get_output_size as Function)();
    if (outputSize === 0) {
      return [];
    }

    const memView = new Uint8Array(this.memory.buffer);
    const lines: Uint8Array[] = [];
    let pos = outputPtr;
    const endPos = outputPtr + outputSize;
    
    while (pos < endPos) {
      const lengthView = new DataView(this.memory.buffer, pos, 4);
      const length = lengthView.getUint32(0, true);
      pos += 4;
      
      const lineData = memView.slice(pos, pos + length);
      lines.push(new Uint8Array(lineData));
      pos += length;
    }
    
    return lines;
  }

  getLeftoverSize(): number {
    return (this.wasmInstance.exports.get_leftover_size as Function)();
  }

  reset(): void {
    (this.wasmInstance.exports.reset_processor as Function)();
  }
}

export async function loadDynamicWasm(): Promise<WebAssembly.Instance> {
  const wasmBytes = await Deno.readFile("./line_processor_dynamic.wasm");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  
  // Let WASM manage its own memory for now
  return await WebAssembly.instantiate(wasmModule);
}

// Test the dynamic line processor
async function main() {
  console.log("Loading dynamic WASM module...");
  const wasmInstance = await loadDynamicWasm();
  const processor = new DynamicLineProcessor(wasmInstance);

  // Test data with various line endings
  const testData = new TextEncoder().encode(
    "First line\n" +
    "Second line\r\n" +
    "Third line without ending"
  );

  console.log("Processing test data...");
  const result = processor.processChunk(testData);
  
  console.log(`Found ${result.length} complete lines`);
  console.log(`Leftover bytes: ${processor.getLeftoverSize()}`);
  
  result.forEach((line, i) => {
    const text = new TextDecoder().decode(line);
    console.log(`Line ${i + 1}: "${text}" (${line.length} bytes)`);
  });

  // Process another chunk to test leftover handling
  const secondChunk = new TextEncoder().encode("\nFourth line\nFifth line\n");
  console.log("\nProcessing second chunk...");
  const result2 = processor.processChunk(secondChunk);
  
  console.log(`Found ${result2.length} complete lines`);
  console.log(`Leftover bytes: ${processor.getLeftoverSize()}`);
  
  result2.forEach((line, i) => {
    const text = new TextDecoder().decode(line);
    console.log(`Line ${i + 1}: "${text}" (${line.length} bytes)`);
  });

  // Flush any remaining data
  console.log("\nFlushing remaining data...");
  const final = processor.flushLeftover();
  final.forEach((line, i) => {
    const text = new TextDecoder().decode(line);
    console.log(`Final line: "${text}" (${line.length} bytes)`);
  });
}

if (import.meta.main) {
  main().catch(console.error);
}
