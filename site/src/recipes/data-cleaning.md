# Data Cleaning Pipeline

Build practical data cleaning pipelines that normalize, validate, and enrich messy real-world data.

## Basic Cleaning: Normalize Text

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* normalizeText(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    yield row.map(field =>
      field.trim()                    // Remove whitespace
           .replace(/\s+/g, " ")      // Collapse multiple spaces
           .replace(/[^\x20-\x7E]/g, "") // Remove non-printable chars
    );
  }
}

await read("messy-data.csv")
  .transform(fromCsvToRows())
  .transform(normalizeText)
  .transform(toCsv())
  .writeTo("clean-data.csv");
```

## Clean Customer Data

Real-world example: normalize names, emails, phone numbers:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

function titleCase(str: string): string {
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

function cleanPhone(phone: string): string {
  // Extract digits only
  const digits = phone.replace(/\D/g, "");
  // Format as (XXX) XXX-XXXX
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return phone; // Return original if invalid
}

async function* cleanCustomers(rows: AsyncIterable<string[]>) {
  for await (const [name, email, phone, status] of rows) {
    yield [
      titleCase(name.trim()),
      email.trim().toLowerCase(),
      cleanPhone(phone),
      status.toLowerCase()
    ];
  }
}

await read("customers.csv")
  .transform(fromCsvToRows())
  .transform(cleanCustomers)
  .transform(toCsv())
  .writeTo("customers-clean.csv");
```

## Validate and Filter

Remove invalid rows while logging issues:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* validateAndClean(rows: AsyncIterable<string[]>) {
  let lineNum = 0;
  let validCount = 0;
  let invalidCount = 0;
  
  for await (const row of rows) {
    lineNum++;
    
    // Must have exactly 4 columns
    if (row.length !== 4) {
      console.error(`Line ${lineNum}: Expected 4 columns, got ${row.length}`);
      invalidCount++;
      continue;
    }
    
    const [id, name, email, amount] = row;
    
    // Validate ID (must be numeric)
    if (!/^\d+$/.test(id)) {
      console.error(`Line ${lineNum}: Invalid ID: ${id}`);
      invalidCount++;
      continue;
    }
    
    // Validate email
    if (!email.includes("@")) {
      console.error(`Line ${lineNum}: Invalid email: ${email}`);
      invalidCount++;
      continue;
    }
    
    // Validate amount (must be numeric)
    if (isNaN(parseFloat(amount))) {
      console.error(`Line ${lineNum}: Invalid amount: ${amount}`);
      invalidCount++;
      continue;
    }
    
    validCount++;
    yield row;
  }
  
  console.log(`\nValidation complete: ${validCount} valid, ${invalidCount} invalid`);
}

await read("data.csv")
  .transform(fromCsvToRows())
  .transform(validateAndClean)
  .transform(toCsv())
  .writeTo("data-valid.csv");
```

## Deduplicate Rows

Remove duplicate rows based on a key:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* deduplicateByKey(
  rows: AsyncIterable<string[]>,
  keyIndex: number
) {
  const seen = new Set<string>();
  
  for await (const row of rows) {
    const key = row[keyIndex];
    
    if (!seen.has(key)) {
      seen.add(key);
      yield row;
    }
  }
}

await read("orders.csv")
  .transform(fromCsvToRows())
  .transform(rows => deduplicateByKey(rows, 0)) // Dedupe by column 0 (order ID)
  .transform(toCsv())
  .writeTo("orders-unique.csv");
```

## Enrich with Computed Fields

Add calculated columns:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* enrichSales(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    const [orderId, product, quantity, price] = row;
    
    const qty = parseInt(quantity);
    const unitPrice = parseFloat(price);
    const total = qty * unitPrice;
    const tax = total * 0.08;
    const grandTotal = total + tax;
    
    yield [
      orderId,
      product,
      quantity,
      price,
      total.toFixed(2),
      tax.toFixed(2),
      grandTotal.toFixed(2)
    ];
  }
}

await read("sales.csv")
  .transform(fromCsvToRows())
  .transform(enrichSales)
  .transform(toCsv())
  .writeTo("sales-enriched.csv");
```

## Complete Pipeline: Clean, Validate, Enrich

Combine multiple cleaning steps:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

// Step 1: Normalize text
async function* normalize(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    yield row.map(field => field.trim().replace(/\s+/g, " "));
  }
}

// Step 2: Validate
async function* validate(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    if (row.length === 4 && !isNaN(parseFloat(row[3]))) {
      yield row;
    }
  }
}

// Step 3: Enrich
async function* enrich(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    const amount = parseFloat(row[3]);
    const category = amount > 1000 ? "high" : "normal";
    yield [...row, category];
  }
}

// Run the pipeline
await read("raw-data.csv")
  .transform(fromCsvToRows())
  .transform(normalize)
  .transform(validate)
  .transform(enrich)
  .transform(toCsv())
  .writeTo("processed-data.csv");
```

## Handle Missing Values

Replace empty fields with defaults:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* fillDefaults(rows: AsyncIterable<string[]>) {
  const defaults = ["", "Unknown", "N/A", "0"];
  
  for await (const row of rows) {
    yield row.map((field, i) => 
      field.trim() === "" ? defaults[i] || "" : field
    );
  }
}

await read("data-with-blanks.csv")
  .transform(fromCsvToRows())
  .transform(fillDefaults)
  .transform(toCsv())
  .writeTo("data-filled.csv");
```

## Clean and Compress

Process large files and compress output:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toTsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* cleanAndFilter(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    // Clean
    const cleaned = row.map(field => field.trim().toLowerCase());
    
    // Filter: only active records
    if (cleaned[3] === "active") {
      yield cleaned;
    }
  }
}

await read("large-dataset.csv.gz")
  .transform(new DecompressionStream("gzip"))
  .transform(fromCsvToRows())
  .transform(cleanAndFilter)
  .transform(toTsv())
  .transform(new CompressionStream("gzip"))
  .writeTo("clean-active.tsv.gz");
```

## Batch Processing Multiple Files

Clean multiple files in parallel:

<!-- NOT TESTED: Illustrative example -->
```typescript
import { enumerate, read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* cleanData(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    yield row.map(field => field.trim().toLowerCase());
  }
}

const files = ["data1.csv", "data2.csv", "data3.csv"];

await enumerate(files)
  .concurrentMap(async (file) => {
    const outFile = file.replace(".csv", "-clean.csv");
    
    await read(file)
      .transform(fromCsvToRows())
      .transform(cleanData)
      .transform(toCsv())
      .writeTo(outFile);
    
    return outFile;
  }, { concurrency: 3 })
  .forEach(file => console.log(`Cleaned: ${file}`));
```

## Real-World: Clean Survey Data

<!-- NOT TESTED: Illustrative example -->
```typescript
import { read } from "jsr:@j50n/proc@{{gitv}}";
import { fromCsvToRows, toCsv } from "jsr:@j50n/proc@{{gitv}}/transforms";

async function* cleanSurvey(rows: AsyncIterable<string[]>) {
  for await (const row of rows) {
    const [id, age, income, satisfaction] = row;
    
    // Normalize age (remove non-digits)
    const cleanAge = age.replace(/\D/g, "");
    
    // Normalize income (remove $, commas)
    const cleanIncome = income.replace(/[$,]/g, "");
    
    // Normalize satisfaction (1-5 scale)
    const satisfactionMap: Record<string, string> = {
      "very satisfied": "5",
      "satisfied": "4",
      "neutral": "3",
      "dissatisfied": "2",
      "very dissatisfied": "1"
    };
    const cleanSatisfaction = satisfactionMap[satisfaction.toLowerCase()] || satisfaction;
    
    // Only yield if all fields are valid
    if (cleanAge && cleanIncome && cleanSatisfaction) {
      yield [id, cleanAge, cleanIncome, cleanSatisfaction];
    }
  }
}

await read("survey-responses.csv")
  .transform(fromCsvToRows())
  .transform(cleanSurvey)
  .transform(toCsv())
  .writeTo("survey-clean.csv");
```

## Performance Tips

1. **Use LazyRow for large files** — Only parse fields you need
2. **Filter early** — Remove invalid rows before expensive operations
3. **Compress output** — Save disk space for large cleaned datasets
4. **Batch process** — Use `concurrentMap` for multiple files

## Next Steps

- [Custom Transforms](custom-transforms.md) - Write reusable transforms
- [Data Conversion](data-conversion.md) - Format conversions
- [Compression](compression.md) - Compress cleaned data
