class SimpleSliceProcessor {
  private wasmInstance: WebAssembly.Instance;
  private memory: WebAssembly.Memory;
  private buffer: Uint8Array;
  
  // Memory layout in one big buffer:
  // [input area][output area][leftover area][working space]
  private inputOffset = 0;
  private outputOffset = 100 * 1024;      // 100KB for input
  private leftoverOffset = 300 * 1024;    // 200KB for output  
  private leftoverLen = 0;

  constructor(wasmInstance: WebAssembly.Instance) {
    this.wasmInstance = wasmInstance;
    this.memory = wasmInstance.exports.memory as WebAssembly.Memory;
    
    // Ensure we have enough memory
    const needed = 500 * 1024; // 500KB total
    if (this.memory.buffer.byteLength < needed) {
      this.memory.grow(Math.ceil((needed - this.memory.buffer.byteLength) / 65536));
    }
    
    this.buffer = new Uint8Array(this.memory.buffer);
  }

  processChunk(data: Uint8Array): Uint8Array[] {
    // Put input data anywhere in the buffer
    this.buffer.set(data, this.inputOffset);
    
    // Call WASM with pointers to slices
    const result = (this.wasmInstance.exports.process_lines as Function)(
      this.inputOffset,                    // input slice
      data.length,
      this.outputOffset,                   // output slice  
      200 * 1024,
      this.leftoverOffset,                 // leftover slice
      this.leftoverLen,
      200 * 1024
    );
    
    const outputLen = result & 0xFFFFFF;
    this.leftoverLen = (result >> 24) & 0xFF;
    
    // Extract lines from output area
    const lines: Uint8Array[] = [];
    let pos = 0;
    
    while (pos < outputLen) {
      const lengthView = new DataView(this.memory.buffer, this.outputOffset + pos, 4);
      const length = lengthView.getUint32(0, true);
      pos += 4;
      
      const lineData = this.buffer.slice(this.outputOffset + pos, this.outputOffset + pos + length);
      lines.push(lineData);
      pos += length;
    }
    
    return lines;
  }

  // For huge lines, just move the areas around in the same buffer
  expandForHugeLine(lineSize: number) {
    const newLeftoverOffset = 1024 * 1024; // Move leftover area to 1MB mark
    const newOutputOffset = newLeftoverOffset + lineSize + 100 * 1024;
    
    // Grow memory if needed
    const totalNeeded = newOutputOffset + lineSize * 2;
    if (this.memory.buffer.byteLength < totalNeeded) {
      this.memory.grow(Math.ceil((totalNeeded - this.memory.buffer.byteLength) / 65536));
      this.buffer = new Uint8Array(this.memory.buffer);
    }
    
    // Move existing leftover data to new location
    if (this.leftoverLen > 0) {
      this.buffer.copyWithin(newLeftoverOffset, this.leftoverOffset, this.leftoverOffset + this.leftoverLen);
    }
    
    this.leftoverOffset = newLeftoverOffset;
    this.outputOffset = newOutputOffset;
  }
}

export async function loadSimpleWasm(): Promise<WebAssembly.Instance> {
  const wasmBytes = await Deno.readFile("./simple.wasm");
  const wasmModule = await WebAssembly.compile(wasmBytes);
  return await WebAssembly.instantiate(wasmModule);
}

// Test
async function main() {
  console.log("=== Simple Slice Management ===\n");
  
  const wasmInstance = await loadSimpleWasm();
  const processor = new SimpleSliceProcessor(wasmInstance);
  
  const testData = new TextEncoder().encode("Line 1\nLine 2\nPartial");
  const lines = processor.processChunk(testData);
  
  console.log(`Found ${lines.length} lines:`);
  lines.forEach((line, i) => {
    console.log(`  ${i + 1}: "${new TextDecoder().decode(line)}"`);
  });
  
  // Continue with second chunk
  const secondData = new TextEncoder().encode(" continues\nLine 4\n");
  const moreLines = processor.processChunk(secondData);
  
  console.log(`\nSecond chunk found ${moreLines.length} lines:`);
  moreLines.forEach((line, i) => {
    console.log(`  ${i + 1}: "${new TextDecoder().decode(line)}"`);
  });
}

if (import.meta.main) {
  main().catch(console.error);
}
