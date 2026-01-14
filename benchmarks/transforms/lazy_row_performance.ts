// deno-lint-ignore-file no-unused-vars require-await
import { LazyRow } from "../../src/transforms/mod.ts";

// Generate test data for LazyRow benchmarks
function generateTestData(fieldCount: number, rowCount: number): string[][] {
  const data: string[][] = [];

  for (let i = 0; i < rowCount; i++) {
    const row: string[] = [];
    for (let j = 0; j < fieldCount; j++) {
      row.push(`field_${i}_${j}_${"x".repeat(10)}`); // ~20 chars per field
    }
    data.push(row);
  }

  return data;
}

async function benchmarkLazyRowCreation(
  name: string,
  data: string[][],
  iterations = 5,
) {
  console.log(`\n=== ${name} - LazyRow Creation ===`);
  console.log(`Rows: ${data.length}, Fields per row: ${data[0]?.length || 0}`);

  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const lazyRows = data.map((row) => LazyRow.fromStringArray(row));
    const end = performance.now();
    times.push(end - start);

    if (i === 0) {
      const totalFields = data.length * (data[0]?.length || 0);
      console.log(`Total fields: ${totalFields.toLocaleString()}`);
    }
  }

  const avgTime = times.reduce((a, b) => a + b) / times.length;
  const totalFields = data.length * (data[0]?.length || 0);
  console.log(`Creation time: ${avgTime.toFixed(2)}ms`);
  console.log(
    `Fields/sec: ${(totalFields / (avgTime / 1000)).toLocaleString()}`,
  );
}

async function benchmarkFieldAccess(
  name: string,
  lazyRows: LazyRow[],
  accessPattern: "sequential" | "random" | "selective",
  iterations = 3,
) {
  console.log(`\n=== ${name} - ${accessPattern} Field Access ===`);

  const times: number[] = [];
  let accessCount = 0;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();

    if (accessPattern === "sequential") {
      // Access all fields in all rows
      for (const row of lazyRows) {
        for (let j = 0; j < row.columnCount; j++) {
          row.getField(j);
          accessCount++;
        }
      }
    } else if (accessPattern === "selective") {
      // Access only first and last field of each row (common pattern)
      for (const row of lazyRows) {
        row.getField(0);
        if (row.columnCount > 1) row.getField(row.columnCount - 1);
        accessCount += Math.min(2, row.columnCount);
      }
    } else { // random
      // Access random fields
      for (const row of lazyRows) {
        const randomField = Math.floor(Math.random() * row.columnCount);
        row.getField(randomField);
        accessCount++;
      }
    }

    const end = performance.now();
    times.push(end - start);
  }

  const avgTime = times.reduce((a, b) => a + b) / times.length;
  console.log(`Access time: ${avgTime.toFixed(2)}ms`);
  console.log(
    `Accesses/sec: ${
      (accessCount / iterations / (avgTime / 1000)).toLocaleString()
    }`,
  );
}

async function benchmarkConversion(
  name: string,
  lazyRows: LazyRow[],
  iterations = 3,
) {
  console.log(`\n=== ${name} - Conversion ===`);

  const toArrayTimes: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    lazyRows.forEach((row) => row.toStringArray());
    const end = performance.now();
    toArrayTimes.push(end - start);
  }

  const avgTime = toArrayTimes.reduce((a, b) => a + b) / toArrayTimes.length;
  console.log(`toStringArray time: ${avgTime.toFixed(2)}ms`);
  console.log(
    `Rows/sec: ${(lazyRows.length / (avgTime / 1000)).toLocaleString()}`,
  );
}

// Run benchmarks
console.log("LazyRow Performance Benchmarks");
console.log("==============================");

// Test different data sizes
const smallData = generateTestData(5, 1000); // 5K fields
const mediumData = generateTestData(10, 5000); // 50K fields
const largeData = generateTestData(20, 10000); // 200K fields

// Creation benchmarks
await benchmarkLazyRowCreation("Small Dataset", smallData);
await benchmarkLazyRowCreation("Medium Dataset", mediumData);
await benchmarkLazyRowCreation("Large Dataset", largeData);

// Access pattern benchmarks (use medium dataset)
const mediumLazyRows = mediumData.map((row) => LazyRow.fromStringArray(row));

await benchmarkFieldAccess("Medium Dataset", mediumLazyRows, "sequential");
await benchmarkFieldAccess("Medium Dataset", mediumLazyRows, "selective");
await benchmarkFieldAccess("Medium Dataset", mediumLazyRows, "random");

// Conversion benchmarks
await benchmarkConversion("Medium Dataset", mediumLazyRows);

console.log("\n=== LazyRow vs String Array Comparison ===");
const testData = generateTestData(10, 1000);

// LazyRow creation + selective access
const lazyStart = performance.now();
const lazyRows = testData.map((row) => LazyRow.fromStringArray(row));
lazyRows.forEach((row) => {
  row.getField(0); // Only access first field
  row.getField(row.columnCount - 1); // And last field
});
const lazyEnd = performance.now();

// Direct string array access
const arrayStart = performance.now();
testData.forEach((row) => {
  row[0]; // Access first field
  row[row.length - 1]; // Access last field
});
const arrayEnd = performance.now();

console.log(
  `LazyRow (creation + selective access): ${
    (lazyEnd - lazyStart).toFixed(2)
  }ms`,
);
console.log(
  `String Array (direct access): ${(arrayEnd - arrayStart).toFixed(2)}ms`,
);
console.log(
  `Overhead: ${((lazyEnd - lazyStart) / (arrayEnd - arrayStart)).toFixed(2)}x`,
);
