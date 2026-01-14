#!/usr/bin/env -S deno run --allow-write --allow-read

console.log("Generating benchmark datasets...\n");

const specialChars = [
  "café",
  "naïve",
  "🚀",
  "résumé",
  "Zürich",
  "東京",
  "москва",
];
const cities = [
  "New York",
  "London",
  "Paris",
  "Tokyo",
  "Sydney",
  "Berlin",
  "São Paulo",
];
const names = ["Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace"];

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function generateRow(
  rowIndex: number,
  columnCount: number,
): Record<string, string> {
  const row: Record<string, string> = {};

  for (let col = 0; col < columnCount; col++) {
    let value: string;

    if (col === 0) {
      value = rowIndex.toString();
    } else if (col === 1 && columnCount > 1) {
      // Mix in some special characters occasionally
      value = Math.random() < 0.1
        ? getRandomItem(specialChars)
        : getRandomItem(names);
    } else if (col === 2 && columnCount > 2) {
      value = `${getRandomItem(names).toLowerCase()}@example.com`;
    } else if (col === 3 && columnCount > 3) {
      value = (25 + (rowIndex % 40)).toString();
    } else if (col === 4 && columnCount > 4) {
      value = Math.random() < 0.05
        ? getRandomItem(specialChars)
        : getRandomItem(cities);
    } else {
      // Regular field with occasional special chars
      value = Math.random() < 0.02
        ? getRandomItem(specialChars)
        : `field_${rowIndex}_${col}`;
    }

    row[`column_${col}`] = value;
  }

  return row;
}

async function writeDataset(filename: string, rows: number, columns: number) {
  console.log(`Generating ${filename}...`);

  const data: Record<string, string>[] = [];
  for (let i = 0; i < rows; i++) {
    data.push(generateRow(i, columns));
  }

  const headers = Object.keys(data[0]);

  // Write CSV
  const csvFile = filename.replace(".csv", ".csv");
  const csvContent = [
    headers.join(","),
    ...data.map((row) => headers.map((h) => row[h]).join(",")),
  ].join("\n") + "\n"; // Add final newline
  await Deno.writeTextFile(`benchmarks/data/${csvFile}`, csvContent);

  // Write TSV
  const tsvFile = filename.replace(".csv", ".tsv");
  const tsvContent = [
    headers.join("\t"),
    ...data.map((row) => headers.map((h) => row[h]).join("\t")),
  ].join("\n") + "\n"; // Add final newline
  await Deno.writeTextFile(`benchmarks/data/${tsvFile}`, tsvContent);

  // Write JSON
  const jsonFile = filename.replace(".csv", ".json");
  const jsonContent = data.map((row) => JSON.stringify(row)).join("\n") + "\n"; // Add final newline
  await Deno.writeTextFile(`benchmarks/data/${jsonFile}`, jsonContent);

  const csvSize = (csvContent.length / 1024 / 1024).toFixed(2);
  console.log(
    `  Generated ${filename.replace(".csv", ".{csv,tsv,json}")}: ${csvSize} MB`,
  );
}

// Create data directory
try {
  await Deno.mkdir("benchmarks/data", { recursive: true });
} catch {
  // Directory already exists
}

// Generate smaller, focused datasets
await writeDataset("small_10col.csv", 1000, 10); // ~40KB each
await writeDataset("small_100col.csv", 100, 100); // ~40KB each
await writeDataset("medium_10col.csv", 50000, 10); // ~2MB each
await writeDataset("medium_100col.csv", 10000, 100); // ~4MB each
await writeDataset("large_10col.csv", 200000, 10); // ~8MB each

console.log("\nDataset generation complete!");
console.log("\nGenerated files:");
console.log("  small_10col.{csv,tsv,json} - 1,000 rows × 10 columns");
console.log("  small_100col.{csv,tsv,json} - 100 rows × 100 columns");
console.log("  medium_10col.{csv,tsv,json} - 50,000 rows × 10 columns");
console.log("  medium_100col.{csv,tsv,json} - 10,000 rows × 100 columns");
console.log("  large_10col.{csv,tsv,json} - 200,000 rows × 10 columns");
