#!/usr/bin/env -S deno run

// Test just the decoder overhead, not memory transfer
function testDecoderOverhead() {
  const testString = "Hello World! ".repeat(1000); // 13KB string
  
  // Pre-encode once
  const utf8Bytes = new TextEncoder().encode(testString);
  const utf16Buffer = new ArrayBuffer(testString.length * 2);
  const utf16View = new Uint16Array(utf16Buffer);
  for (let i = 0; i < testString.length; i++) {
    utf16View[i] = testString.charCodeAt(i);
  }
  const utf16Bytes = new Uint8Array(utf16Buffer);
  
  console.log(`UTF-8 size: ${utf8Bytes.length} bytes`);
  console.log(`UTF-16 size: ${utf16Bytes.length} bytes`);
  
  // Create decoders once
  const utf8Decoder = new TextDecoder('utf-8');
  const utf16Decoder = new TextDecoder('utf-16le');
  
  const iterations = 10000;
  
  // Benchmark UTF-8
  const start8 = performance.now();
  for (let i = 0; i < iterations; i++) {
    utf8Decoder.decode(utf8Bytes);
  }
  const end8 = performance.now();
  
  // Benchmark UTF-16
  const start16 = performance.now();
  for (let i = 0; i < iterations; i++) {
    utf16Decoder.decode(utf16Bytes);
  }
  const end16 = performance.now();
  
  console.log(`UTF-8 time: ${(end8 - start8).toFixed(2)}ms`);
  console.log(`UTF-16 time: ${(end16 - start16).toFixed(2)}ms`);
  console.log(`Ratio: ${((end16 - start16) / (end8 - start8)).toFixed(2)}x`);
}

testDecoderOverhead();
