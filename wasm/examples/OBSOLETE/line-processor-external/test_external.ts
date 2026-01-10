export class ExternalMemoryLineProcessor {
  private wasmInstance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  
  // JavaScript manages all buffers
  private inputBuffer: Uint8Array;
  private outputBuffer: Uint8Array;
  private leftoverBuffer: Uint8Array;
  
  // Memory offsets in WASM
  private inputOffset: number;
  private outputOffset: number;
  private leftoverOffset: number;

  constructor(wasmInstance: WebAssembly.Instance, 
              inputSize: number = 64 * 1024,
              outputSize: number = 128 * 1024, 
              leftoverSize: number = 4 * 1024) {
    this.wasmInstance = wasmInstance;
    this.memory = wasmInstance.exports.memory as WebAssembly.Memory;
    
    // Allocate buffers in WASM memory
    this.inputOffset = 0;
    this.outputOffset = inputSize;
    this.leftoverOffset = inputSize + outputSize;
    
    // Ensure WASM memory is big enough
    const totalNeeded = inputSize + outputSize + leftoverSize;
    const currentSize = this.memory.buffer.byteLength;
    if (currentSize < totalNeeded) {
      const pagesNeeded = Math.ceil((totalNeeded - currentSize) / 65536);
      this.memory.grow(pagesNeeded);
    }
    
    // Create views into WASM memory
    this.inputBuffer = new Uint8Array(this.memory.buffer, this.inputOffset, inputSize);
    this.outputBuffer = new Uint8Array(this.memory.buffer, this.outputOffset, outputSize);
    this.leftoverBuffer = new Uint8Array(this.memory.buffer, this.leftoverOffset, leftoverSize);
  }

  // Resize buffers dynamically for huge lines
  resizeBuffers(inputSize: number, outputSize: number, leftoverSize: number) {
    const totalNeeded = inputSize + outputSize + leftoverSize;
    const currentSize = this.memory.buffer.byteLength;
    
    if (currentSize < totalNeeded) {
      const pagesNeeded = Math.ceil((totalNeeded - currentSize) / 65536);
      this.memory.grow(pagesNeeded);
    }
    
    // Reallocate buffer views
    this.inputOffset = 0;
    this.outputOffset = inputSize;
    this.leftoverOffset = inputSize + outputSize;
    
    this.inputBuffer = new Uint8Array(this.memory.buffer, this.inputOffset, inputSize);
    this.outputBuffer = new Uint8Array(this.memory.buffer, this.outputOffset, outputSize);
    this.leftoverBuffer = new Uint8Array(this.memory.buffer, this.leftoverOffset, leftoverSize);
  }

  processChunk(data: Uint8Array): Uint8Array[] {
    // Check if we need to resize for this chunk
    if (data.length > this.inputBuffer.length) {
      const newInputSize = Math.max(data.length * 2, this.inputBuffer.length);
      const newOutputSize = Math.max(newInputSize * 2, this.outputBuffer.length);
      const newLeftoverSize = Math.max(data.length, this.leftoverBuffer.length);
      
      console.log(`Resizing buffers: input=${newInputSize}, output=${newOutputSize}, leftover=${newLeftoverSize}`);
      this.resizeBuffers(newInputSize, newOutputSize, newLeftoverSize);
    }
    
    // Copy input data to WASM memory
    this.inputBuffer.set(data);
    
    // Call WASM function with pointers to our managed memory
    const outputLen = (this.wasmInstance.exports.process_lines as Function)(
      this.inputOffset,           // input_ptr
      data.length,               // input_len
      this.outputOffset,         // output_ptr
      this.outputBuffer.length,  // output_size
      this.leftoverOffset,       // leftover_ptr
      this.leftoverBuffer.length // leftover_size
    );
    
    if (outputLen === 0) {
      // Need more space - try doubling buffer sizes
      const newOutputSize = this.outputBuffer.length * 2;
      const newLeftoverSize = this.leftoverBuffer.length * 2;
      
      console.log(`Retrying with larger buffers: output=${newOutputSize}, leftover=${newLeftoverSize}`);
      this.resizeBuffers(this.inputBuffer.length, newOutputSize, newLeftoverSize);
      
      // Retry
      this.inputBuffer.set(data);
      const retryOutputLen = (this.wasmInstance.exports.process_lines as Function)(
        this.inputOffset, data.length, this.outputOffset, this.outputBuffer.length,
        this.leftoverOffset, this.leftoverBuffer.length
      );
      
      if (retryOutputLen === 0) {
        throw new Error("Failed to process chunk even with larger buffers");
      }
      
      return this.extractLines(retryOutputLen);
    }
    
    return this.extractLines(outputLen);
  }

  private extractLines(outputLen: number): Uint8Array[] {
    const lines: Uint8Array[] = [];
    let pos = 0;
    
    while (pos < outputLen) {
      // Read 32-bit length
      const lengthView = new DataView(this.memory.buffer, this.outputOffset + pos, 4);
      const length = lengthView.getUint32(0, true);
      pos += 4;
      
      // Read line data
      const lineData = new Uint8Array(this.memory.buffer, this.outputOffset + pos, length);
      lines.push(new Uint8Array(lineData)); // Copy to avoid buffer reuse issues
      pos += length;
    }
    
    return lines;
  }

  getLeftoverSize(): number {
    return (this.wasmInstance.exports.get_leftover_len as Function)();
  }

  getBufferSizes(): { input: number, output: number, leftover: number } {
    return {
      input: this.inputBuffer.length,
      output: this.outputBuffer.length,
      leftover: this.leftoverBuffer.length
    };
  }

  getMemorySize(): number {
    return this.memory.buffer.byteLength;
  }

  reset(): void {
    (this.wasmInstance.exports.reset_leftover as Function)();
  }
}

export async function loadExternalWasm(): Promise<WebAssembly.Instance> {
  const wasmBytes = await Deno.readFile("./line_processor_external.wasm");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  return await WebAssembly.instantiate(wasmModule);
}

// Test the external memory processor
async function main() {
  console.log("=== External Memory Management Test ===\n");
  
  const wasmInstance = await loadExternalWasm();
  const processor = new ExternalMemoryLineProcessor(wasmInstance);
  
  console.log("Initial state:");
  console.log(`  Memory: ${(processor.getMemorySize() / 1024).toFixed(1)}KB`);
  console.log(`  Buffers:`, processor.getBufferSizes());
  console.log();
  
  // Test with normal data
  const testData = new TextEncoder().encode("Line 1\nLine 2\nPartial");
  console.log(`Processing: "${new TextDecoder().decode(testData)}"`);
  
  const result1 = processor.processChunk(testData);
  console.log(`Found ${result1.length} lines, leftover: ${processor.getLeftoverSize()} bytes`);
  result1.forEach((line, i) => {
    console.log(`  Line ${i + 1}: "${new TextDecoder().decode(line)}"`);
  });
  
  // Test with huge line (will trigger buffer resize)
  console.log("\nTesting with huge line...");
  const hugeLine = "A".repeat(200 * 1024) + "\nNormal line\n"; // 200KB line
  const hugeData = new TextEncoder().encode(hugeLine);
  
  console.log(`Processing ${hugeData.length} byte chunk...`);
  const result2 = processor.processChunk(hugeData);
  
  console.log("After huge line:");
  console.log(`  Memory: ${(processor.getMemorySize() / 1024).toFixed(1)}KB`);
  console.log(`  Buffers:`, processor.getBufferSizes());
  console.log(`  Found ${result2.length} lines`);
  console.log(`  First line length: ${result2[0]?.length || 0} bytes`);
  console.log(`  Second line: "${new TextDecoder().decode(result2[1] || new Uint8Array())}"`);
}

if (import.meta.main) {
  main().catch(console.error);
}
