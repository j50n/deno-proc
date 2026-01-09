import { StringRow } from "../../../../src/data-transform/string-row.ts";

console.log("=== Unicode Compatibility Test ===");

// Test data with various Unicode scenarios
const testData = [
  ["café", "世界", "🌍"],           // Mixed Unicode
  ["a🌍b", "test", "normal"],       // Emoji in middle
  ["", "🌍🌍", ""],                // Empty + double emoji
];

console.log("Input data:");
testData.forEach((row, i) => {
  console.log(`Row ${i}: [${row.map(s => `"${s}"`).join(", ")}]`);
  console.log(`  JavaScript lengths: [${row.map(s => s.length).join(", ")}]`);
});

// Test with TypeScript StringRow
console.log("\n=== TypeScript StringRow ===");
testData.forEach((columns, i) => {
  const tsRow = StringRow.fromArray(columns);
  const tsBytes = tsRow.toBytes();
  const tsDeserialized = StringRow.fromBytes(tsBytes);
  const tsResult = tsDeserialized.toArray();
  
  console.log(`Row ${i} TypeScript result: [${tsResult.map(s => `"${s}"`).join(", ")}]`);
  console.log(`  Serialized bytes: ${tsBytes.length} bytes`);
  console.log(`  Hex: ${Array.from(tsBytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
});

// Test with Odin child process
console.log("\n=== Odin Child Process ===");
const csvInput = testData.map(row => row.join(",")).join("\n");
console.log(`CSV input:\n${csvInput}`);

const process = new Deno.Command("./build/child_process", {
  stdin: "piped",
  stdout: "piped",
  stderr: "piped",
});

const child = process.spawn();
const writer = child.stdin.getWriter();
await writer.write(new TextEncoder().encode(csvInput));
await writer.close();

const { code, stdout, stderr } = await child.output();

if (code !== 0) {
  console.error("Child process failed:", new TextDecoder().decode(stderr));
  Deno.exit(1);
}

// Parse Odin output
const odinBytes = stdout;
console.log(`Odin output: ${odinBytes.length} bytes`);

let offset = 0;
let rowIndex = 0;

while (offset < odinBytes.length) {
  // Read length prefix
  const lengthView = new DataView(odinBytes.buffer, offset, 4);
  const length = lengthView.getUint32(0, true); // little-endian
  offset += 4;
  
  // Read StringRow data
  const rowBytes = odinBytes.slice(offset, offset + length);
  offset += length;
  
  // Deserialize with TypeScript StringRow
  const odinRow = StringRow.fromBytes(rowBytes);
  const odinResult = odinRow.toArray();
  
  console.log(`Row ${rowIndex} Odin result: [${odinResult.map(s => `"${s}"`).join(", ")}]`);
  console.log(`  Serialized bytes: ${rowBytes.length} bytes`);
  console.log(`  Hex: ${Array.from(rowBytes.slice(0, 32)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
  
  // Verify compatibility
  const expected = testData[rowIndex];
  const matches = odinResult.length === expected.length && 
                  odinResult.every((val, i) => val === expected[i]);
  
  console.log(`  ✅ Match: ${matches ? "YES" : "NO"}`);
  if (!matches) {
    console.log(`    Expected: [${expected.map(s => `"${s}"`).join(", ")}]`);
    console.log(`    Got:      [${odinResult.map(s => `"${s}"`).join(", ")}]`);
  }
  
  rowIndex++;
}

console.log("\n=== Test Complete ===");
