#!/usr/bin/env -S deno run --allow-read

// Generate test data
function generateTestStrings(count: number, avgLength: number): string[] {
  const strings: string[] = [];
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 !@#$%^&*()_+-=[]{}|;:,.<>?";
  
  for (let i = 0; i < count; i++) {
    const length = Math.floor(avgLength + (Math.random() - 0.5) * avgLength * 0.5);
    let str = "";
    for (let j = 0; j < length; j++) {
      str += chars[Math.floor(Math.random() * chars.length)];
    }
    strings.push(str);
  }
  return strings;
}

// Pre-encode strings to UTF-8 and UTF-16 byte arrays
function prepareTestData(strings: string[]) {
  const utf8Arrays: Uint8Array[] = [];
  const utf16Arrays: Uint8Array[] = [];
  
  for (const str of strings) {
    utf8Arrays.push(new TextEncoder().encode(str));
    
    // Create UTF-16LE byte array
    const utf16Buffer = new ArrayBuffer(str.length * 2);
    const utf16View = new Uint16Array(utf16Buffer);
    for (let i = 0; i < str.length; i++) {
      utf16View[i] = str.charCodeAt(i);
    }
    utf16Arrays.push(new Uint8Array(utf16Buffer));
  }
  
  return { utf8Arrays, utf16Arrays };
}

// Benchmark UTF-8 decoding
function benchmarkUTF8(utf8Arrays: Uint8Array[], iterations: number): number {
  const decoder = new TextDecoder('utf-8');
  const start = performance.now();
  
  for (let iter = 0; iter < iterations; iter++) {
    for (const bytes of utf8Arrays) {
      decoder.decode(bytes);
    }
  }
  
  const end = performance.now();
  return end - start;
}

// Benchmark UTF-16 decoding
function benchmarkUTF16(utf16Arrays: Uint8Array[], iterations: number): number {
  const decoder = new TextDecoder('utf-16le');
  const start = performance.now();
  
  for (let iter = 0; iter < iterations; iter++) {
    for (const bytes of utf16Arrays) {
      decoder.decode(bytes);
    }
  }
  
  const end = performance.now();
  return end - start;
}

// Run benchmark
async function runBenchmark() {
  console.log("String Encoding Benchmark");
  console.log("========================");
  
  const testCases = [
    { strings: 1000, avgLength: 50, iterations: 100 },
    { strings: 1000, avgLength: 200, iterations: 50 },
    { strings: 10000, avgLength: 50, iterations: 10 },
    { strings: 100, avgLength: 2000, iterations: 100 },
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.strings} strings, avg ${testCase.avgLength} chars, ${testCase.iterations} iterations`);
    
    // Generate test data
    const strings = generateTestStrings(testCase.strings, testCase.avgLength);
    const { utf8Arrays, utf16Arrays } = prepareTestData(strings);
    
    // Calculate total data size
    const utf8Size = utf8Arrays.reduce((sum, arr) => sum + arr.length, 0);
    const utf16Size = utf16Arrays.reduce((sum, arr) => sum + arr.length, 0);
    
    console.log(`UTF-8 total size: ${(utf8Size / 1024).toFixed(1)} KB`);
    console.log(`UTF-16 total size: ${(utf16Size / 1024).toFixed(1)} KB`);
    
    // Warm up
    benchmarkUTF8(utf8Arrays, 1);
    benchmarkUTF16(utf16Arrays, 1);
    
    // Benchmark
    const utf8Time = benchmarkUTF8(utf8Arrays, testCase.iterations);
    const utf16Time = benchmarkUTF16(utf16Arrays, testCase.iterations);
    
    console.log(`UTF-8 decode time: ${utf8Time.toFixed(2)}ms`);
    console.log(`UTF-16 decode time: ${utf16Time.toFixed(2)}ms`);
    console.log(`UTF-8 throughput: ${(utf8Size * testCase.iterations / utf8Time / 1024).toFixed(1)} KB/ms`);
    console.log(`UTF-16 throughput: ${(utf16Size * testCase.iterations / utf16Time / 1024).toFixed(1)} KB/ms`);
    
    const speedup = utf8Time / utf16Time;
    if (speedup > 1) {
      console.log(`UTF-16 is ${speedup.toFixed(2)}x faster than UTF-8`);
    } else {
      console.log(`UTF-8 is ${(1/speedup).toFixed(2)}x faster than UTF-16`);
    }
  }
}

runBenchmark();
