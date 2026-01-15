#!/usr/bin/env -S deno run --allow-write

// Generate record-format test data
// Record format uses 0x1e (record separator) instead of newlines

function generateRecordData(sizeInMB: number, outputPath: string) {
  const fields = ["Alice", "Bob", "Charlie", "Diana", "Eve"];
  const fieldSep = "\x1f";
  const recordSep = "\x1e";
  
  const record = fields.join(fieldSep) + recordSep;
  const bytesPerRecord = new TextEncoder().encode(record).length;
  const totalBytes = sizeInMB * 1024 * 1024;
  const recordCount = Math.floor(totalBytes / bytesPerRecord);
  
  console.log(`Generating ${outputPath}: ${sizeInMB} MB (${recordCount} records)`);
  
  const file = Deno.openSync(outputPath, { write: true, create: true, truncate: true });
  const recordBytes = new TextEncoder().encode(record);
  
  for (let i = 0; i < recordCount; i++) {
    file.writeSync(recordBytes);
  }
  
  file.close();
  console.log(`✓ Created ${outputPath}`);
}

// Generate test files
generateRecordData(1, "data/small.record");
generateRecordData(10, "data/medium.record");
generateRecordData(100, "data/large.record");

console.log("\n✓ All test files generated");
