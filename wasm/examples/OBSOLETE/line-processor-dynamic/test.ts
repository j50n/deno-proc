export class LineProcessor {
  private wasmInstance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private inputBuffer: number;
  private outputBuffer: number;

  constructor(wasmInstance: WebAssembly.Instance) {
    this.wasmInstance = wasmInstance;
    this.memory = wasmInstance.exports.memory as WebAssembly.Memory;
    this.inputBuffer = (wasmInstance.exports.get_input_buffer as Function)();
    this.outputBuffer = (wasmInstance.exports.get_output_buffer as Function)();
  }

  processChunk(data: Uint8Array): { lines: Uint8Array[], leftoverLen: number } {
    if (data.length > 64 * 1024) {
      throw new Error("Input chunk too large (max 64KB)");
    }

    // Copy data to WASM input buffer
    const memView = new Uint8Array(this.memory.buffer);
    if (data.length > 0) {
      memView.set(data, this.inputBuffer);
    }

    // Process the data
    const outputLen = (this.wasmInstance.exports.process_lines as Function)(data.length);
    
    if (outputLen === 0 && data.length > 0) {
      throw new Error("Processing failed - buffer overflow or invalid input");
    }

    // Extract processed lines
    const lines: Uint8Array[] = [];
    let pos = 0;
    
    while (pos < outputLen) {
      // Read 32-bit length (little-endian)
      const lengthBytes = memView.slice(this.outputBuffer + pos, this.outputBuffer + pos + 4);
      const length = new DataView(lengthBytes.buffer, lengthBytes.byteOffset, 4).getUint32(0, true);
      pos += 4;
      
      // Read line data
      const lineData = memView.slice(this.outputBuffer + pos, this.outputBuffer + pos + length);
      lines.push(new Uint8Array(lineData));
      pos += length;
    }

    const leftoverLen = (this.wasmInstance.exports.get_leftover_len as Function)();
    
    return { lines, leftoverLen };
  }

  resetLeftover(): void {
    (this.wasmInstance.exports.reset_leftover as Function)();
  }
}

export async function loadWasm(): Promise<WebAssembly.Instance> {
  const wasmBytes = await Deno.readFile("./line_processor.wasm");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  return await WebAssembly.instantiate(wasmModule);
}

// Test the line processor
async function main() {
  console.log("Loading WASM module...");
  const wasmInstance = await loadWasm();
  const processor = new LineProcessor(wasmInstance);

  // Test data with various line endings
  const testData = new TextEncoder().encode(
    "First line\n" +
    "Second line\r\n" +
    "Third line without ending"
  );

  console.log("Processing test data...");
  const result = processor.processChunk(testData);
  
  console.log(`Found ${result.lines.length} complete lines`);
  console.log(`Leftover bytes: ${result.leftoverLen}`);
  
  result.lines.forEach((line, i) => {
    const text = new TextDecoder().decode(line);
    console.log(`Line ${i + 1}: "${text}" (${line.length} bytes)`);
  });

  // Process another chunk to test leftover handling
  const secondChunk = new TextEncoder().encode("\nFourth line\nFifth line\n");
  console.log("\nProcessing second chunk...");
  const result2 = processor.processChunk(secondChunk);
  
  console.log(`Found ${result2.lines.length} complete lines`);
  console.log(`Leftover bytes: ${result2.leftoverLen}`);
  
  result2.lines.forEach((line, i) => {
    const text = new TextDecoder().decode(line);
    console.log(`Line ${i + 1}: "${text}" (${line.length} bytes)`);
  });
}

if (import.meta.main) {
  main().catch(console.error);
}
