// Performance comparison: StringRow vs TSV vs JSON vs CSV
import { StringRow } from './string-row.ts';
import { stringify, parse } from "jsr:@std/csv";

// TSV functions
function serializeTSV(columns: string[]): Uint8Array {
  const text = columns.join('\t');
  return new TextEncoder().encode(text);
}

function deserializeTSV(bytes: Uint8Array): string[] {
  const text = new TextDecoder().decode(bytes);
  return text.split('\t');
}

// JSON functions
function serializeJSON(columns: string[]): Uint8Array {
  const text = JSON.stringify(columns);
  return new TextEncoder().encode(text);
}

function deserializeJSON(bytes: Uint8Array): string[] {
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text);
}

// CSV functions
function serializeCSV(columns: string[]): Uint8Array {
  const csvString = stringify([columns]);
  return new TextEncoder().encode(csvString);
}

function deserializeCSV(bytes: Uint8Array): string[] {
  const csvString = new TextDecoder().decode(bytes);
  const parsed = parse(csvString);
  return parsed[0] as string[];
}

function runComparison() {
  console.log("StringRow vs TSV vs JSON vs CSV Performance");
  console.log("==========================================");
  
  const testCases = [
    { columns: 10, iterations: 1000, name: "Small rows" },
    { columns: 50, iterations: 200, name: "Medium rows" },
    { columns: 100, iterations: 100, name: "Large rows" },
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.name}: ${testCase.columns} columns, ${testCase.iterations} iterations`);
    
    // Generate test data
    const columns: string[] = [];
    for (let i = 0; i < testCase.columns; i++) {
      const length = Math.floor(Math.random() * 20) + 5;
      columns.push(`col${i}_${'x'.repeat(length)}`);
    }
    
    const totalChars = columns.join('').length;
    console.log(`Total characters: ${totalChars}`);
    
    // Test each approach
    const approaches = [
      {
        name: "StringRow",
        serialize: (cols: string[]) => {
          const row = StringRow.fromArray(cols);
          return row.toBytes();
        },
        deserialize: (bytes: Uint8Array) => {
          const row = StringRow.fromBytes(bytes);
          return row.toArray();
        },
      },
      {
        name: "TSV",
        serialize: serializeTSV,
        deserialize: deserializeTSV,
      },
      {
        name: "JSON", 
        serialize: serializeJSON,
        deserialize: deserializeJSON,
      },
      {
        name: "CSV",
        serialize: serializeCSV,
        deserialize: deserializeCSV,
      },
    ];
    
    for (const approach of approaches) {
      // Proper warmup - 100 iterations
      for (let w = 0; w < 100; w++) {
        const serialized = approach.serialize(columns);
        approach.deserialize(serialized);
      }
      
      // Serialize test
      const serializeStart = performance.now();
      let serialized: Uint8Array;
      for (let i = 0; i < testCase.iterations; i++) {
        serialized = approach.serialize(columns);
      }
      const serializeEnd = performance.now();
      
      // Deserialize test
      const deserializeStart = performance.now();
      for (let i = 0; i < testCase.iterations; i++) {
        approach.deserialize(serialized!);
      }
      const deserializeEnd = performance.now();
      
      const serializeTime = serializeEnd - serializeStart;
      const deserializeTime = deserializeEnd - deserializeStart;
      const totalTime = serializeTime + deserializeTime;
      
      console.log(`\n${approach.name}:`);
      console.log(`  Serialize: ${serializeTime.toFixed(2)}ms (${(serializeTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Deserialize: ${deserializeTime.toFixed(2)}ms (${(deserializeTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Total: ${totalTime.toFixed(2)}ms (${(totalTime/testCase.iterations).toFixed(3)}ms/op)`);
      console.log(`  Size: ${serialized!.length} bytes`);
      console.log(`  Throughput: ${(totalChars * testCase.iterations / totalTime / 1000).toFixed(1)} KB/ms`);
      
      // Verify correctness
      const result = approach.deserialize(serialized!);
      const correct = columns.length === result.length && 
                     columns.every((col, i) => col === result[i]);
      console.log(`  Correct: ${correct}`);
    }
  }
  
  // Test StringRow modification performance
  console.log("\n" + "=".repeat(50));
  console.log("StringRow Modification Performance");
  console.log("=".repeat(50));
  
  const testRow = StringRow.fromArray([
    "id123", "John Doe", "john@email.com", "555-1234", "Active", "Premium"
  ]);
  
  // Modification test
  const modifyStart = performance.now();
  for (let i = 0; i < 10000; i++) {
    testRow.set(2, `email${i}@test.com`);
    testRow.set(4, i % 2 === 0 ? "Active" : "Inactive");
  }
  const modifyEnd = performance.now();
  
  console.log(`\nModified 2 columns 10,000 times: ${(modifyEnd - modifyStart).toFixed(2)}ms`);
  console.log(`Per modification: ${((modifyEnd - modifyStart) / 10000).toFixed(4)}ms`);
  console.log(`Changes tracked: ${testRow.changeCount}`);
  console.log(`Is dirty: ${testRow.isDirty}`);
  
  // Serialization of modified row
  const dirtySerializeStart = performance.now();
  for (let i = 0; i < 1000; i++) {
    testRow.toBytes();
  }
  const dirtySerializeEnd = performance.now();
  
  console.log(`Dirty row serialization (1000x): ${(dirtySerializeEnd - dirtySerializeStart).toFixed(2)}ms`);
  
  // Clean row serialization
  const cleanRow = StringRow.fromArray(["a", "b", "c", "d", "e"]);
  const cleanSerializeStart = performance.now();
  for (let i = 0; i < 1000; i++) {
    cleanRow.toBytes();
  }
  const cleanSerializeEnd = performance.now();
  
  console.log(`Clean row serialization (1000x): ${(cleanSerializeEnd - cleanSerializeStart).toFixed(2)}ms`);
  console.log(`Clean vs Dirty ratio: ${((dirtySerializeEnd - dirtySerializeStart) / (cleanSerializeEnd - cleanSerializeStart)).toFixed(1)}x`);
}

runComparison();
