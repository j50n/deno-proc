#!/usr/bin/env -S deno run

import { stringify, parse } from "jsr:@std/csv";

// Generate unique test data to bust CPU cache
function generateUniqueColumnData(datasetId: number, numColumns: number): string[] {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const columns: string[] = [];
  
  // Use datasetId as seed for different data each time
  let seed = datasetId * 12345;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  
  for (let i = 0; i < numColumns; i++) {
    const length = Math.floor(random() * 20) + 1; // 1-20 chars
    let column = "";
    for (let j = 0; j < length; j++) {
      column += chars[Math.floor(random() * chars.length)];
    }
    columns.push(column);
  }
  
  return columns;
}

// Single-decode approach
function serializeStringsSingleDecode(strings: string[]): Uint8Array {
  const encoder = new TextEncoder();
  const allText = strings.join('');
  const textBytes = encoder.encode(allText);
  
  const indices: number[] = [strings.length];
  let charPos = 0;
  
  for (const str of strings) {
    indices.push(charPos);
    indices.push(str.length);
    charPos += str.length;
  }
  
  const indicesBytes = indices.length * 4;
  const totalSize = indicesBytes + textBytes.length;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  
  for (let i = 0; i < indices.length; i++) {
    view.setUint32(i * 4, indices[i], true);
  }
  
  bytes.set(textBytes, indicesBytes);
  return bytes;
}

function deserializeStringsSingleDecode(buffer: Uint8Array): string[] {
  const view = new DataView(buffer.buffer);
  const count = view.getUint32(0, true);
  const indicesEnd = (1 + count * 2) * 4;
  
  const textBytes = buffer.subarray(indicesEnd);
  const allText = new TextDecoder('utf-8').decode(textBytes);
  
  const strings = new Array<string>(count);
  
  for (let i = 0; i < count; i++) {
    const startPos = view.getUint32((1 + i * 2) * 4, true);
    const length = view.getUint32((1 + i * 2 + 1) * 4, true);
    strings[i] = allText.substring(startPos, startPos + length);
  }
  
  return strings;
}

// TSV approach
function serializeTSV(strings: string[]): Uint8Array {
  const tsvString = strings.join('\t');
  return new TextEncoder().encode(tsvString);
}

function deserializeTSV(buffer: Uint8Array): string[] {
  const tsvString = new TextDecoder('utf-8').decode(buffer);
  return tsvString.split('\t');
}

// JSON approach
function serializeJSON(strings: string[]): Uint8Array {
  const jsonString = JSON.stringify(strings);
  return new TextEncoder().encode(jsonString);
}

function deserializeJSON(buffer: Uint8Array): string[] {
  const jsonString = new TextDecoder('utf-8').decode(buffer);
  return JSON.parse(jsonString);
}

// Deno CSV approach
function serializeCSV(strings: string[]): Uint8Array {
  const csvString = stringify([strings]);
  return new TextEncoder().encode(csvString);
}

function deserializeCSV(buffer: Uint8Array): string[] {
  const csvString = new TextDecoder('utf-8').decode(buffer);
  const parsed = parse(csvString);
  return parsed[0] as string[];
}

// Cache-busting benchmark
function benchmarkCacheBusting() {
  console.log("Cache-Busting Performance Test (250M scale simulation)");
  console.log("====================================================");
  console.log("Testing with many different 100-column datasets to simulate cache misses\n");
  
  const approaches = [
    { name: "Single-Decode", serialize: serializeStringsSingleDecode, deserialize: deserializeStringsSingleDecode },
    { name: "TSV (Tab Split)", serialize: serializeTSV, deserialize: deserializeTSV },
    { name: "JSON", serialize: serializeJSON, deserialize: deserializeJSON },
    { name: "Deno CSV", serialize: serializeCSV, deserialize: deserializeCSV },
  ];
  
  // Test different scales to see cache effects
  const testCases = [
    { datasets: 1000, description: "1K datasets (fits in L3 cache)" },
    { datasets: 10000, description: "10K datasets (exceeds L3 cache)" },
    { datasets: 50000, description: "50K datasets (heavy cache pressure)" },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.description}:`);
    console.log("=".repeat(testCase.description.length + 1));
    
    for (const approach of approaches) {
      // Generate unique datasets to bust cache
      const datasets: string[][] = [];
      for (let i = 0; i < testCase.datasets; i++) {
        datasets.push(generateUniqueColumnData(i, 100));
      }
      
      // Warmup with a few datasets
      for (let w = 0; w < 10; w++) {
        const warmupData = approach.serialize(datasets[w % datasets.length]);
        approach.deserialize(warmupData);
      }
      
      // Benchmark: process all unique datasets
      const start = performance.now();
      let totalBytes = 0;
      
      for (let i = 0; i < testCase.datasets; i++) {
        const serialized = approach.serialize(datasets[i]);
        const deserialized = approach.deserialize(serialized);
        totalBytes += serialized.length;
      }
      
      const end = performance.now();
      const totalTime = end - start;
      const avgTime = totalTime / testCase.datasets;
      const throughput = (totalBytes / totalTime) / 1024; // KB/ms
      
      console.log(`${approach.name}:`);
      console.log(`  Total time: ${totalTime.toFixed(0)}ms`);
      console.log(`  Avg per dataset: ${avgTime.toFixed(3)}ms`);
      console.log(`  Throughput: ${throughput.toFixed(1)} KB/ms`);
      console.log(`  Total data: ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
      
      // Estimate time for 250M datasets
      const estimatedTime250M = (avgTime * 250_000_000) / 1000 / 60; // minutes
      console.log(`  Est. 250M datasets: ${estimatedTime250M.toFixed(1)} minutes`);
      console.log();
    }
  }
}

benchmarkCacheBusting();
