import { FlatText } from "../../wasm/flattext-api.ts";

console.log("🧪 Testing FlatText API...\n");

const converter = await FlatText.create();

// Test basic conversion
const csv = `name,age,city
Alice,30,"New York"
Bob,25,Chicago
Carol,35,"Los Angeles"`;

console.log("📄 Input CSV:");
console.log(csv);

const tsv = converter.csvToTsv(csv);
console.log("\n📄 Output TSV:");
console.log(tsv);

// Test with configuration
const csvWithSemicolons = `name;age;city
Alice;30;New York
Bob;25;Chicago`;

console.log("\n📄 Input CSV (semicolon delimiter):");
console.log(csvWithSemicolons);

const tsvFromSemicolon = converter.csvToTsv(csvWithSemicolons, {
  delimiter: ";"
});

console.log("\n📄 Output TSV:");
console.log(tsvFromSemicolon);

console.log("\n✅ API test complete!");
