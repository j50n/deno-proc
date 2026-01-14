import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { fromCsvToRows, fromCsvToLazyRows, toCsv } from "../../src/transforms/csv.ts";

Deno.test("CSV - basic parsing to rows", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ]);
});

Deno.test("CSV - basic parsing to LazyRows", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0].length, 3); // header + 2 data rows
  assertEquals(result[0][0].toStringArray(), ["name", "age", "city"]);
  assertEquals(result[0][1].toStringArray(), ["Alice", "30", "NYC"]);
  assertEquals(result[0][2].toStringArray(), ["Bob", "25", "LA"]);
});

Deno.test("CSV - chunked input", async () => {
  const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ]);
});

Deno.test("CSV - quoted fields with commas", async () => {
  const csvData = 'name,description\n"Alice","A person with, comma"\n"Bob","Another ""quoted"" person"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", "A person with, comma"],
      ["Bob", 'Another "quoted" person']
    ]
  ]);
});

Deno.test("CSV - quoted fields with newlines", async () => {
  const csvData = 'name,description\n"Alice","Line 1\nLine 2"\n"Bob","Single line"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", "Line 1\nLine 2"],
      ["Bob", "Single line"]
    ]
  ]);
});

Deno.test("CSV - custom separator", async () => {
  const csvData = "name;age;city\nAlice;30;NYC\nBob;25;LA";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: ";" }))
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ]);
});

Deno.test("CSV - custom separator with quotes", async () => {
  const csvData = 'name;description\n"Alice";"Has ; semicolon"\n"Bob";"Normal text"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: ";" }))
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", "Has ; semicolon"],
      ["Bob", "Normal text"]
    ]
  ]);
});

Deno.test("CSV - comments", async () => {
  const csvData = "# This is a comment\nname,age\n# Another comment\nAlice,30\nBob,25";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ comment: "#" }))
    .collect();
  
  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ]);
});

Deno.test("CSV - trim leading space", async () => {
  const csvData = "name, age, city\n Alice , 30 , NYC \n Bob , 25 , LA ";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ trimLeadingSpace: true }))
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice ", "30 ", "NYC "], ["Bob ", "25 ", "LA "]]
  ]);
});

Deno.test("CSV - lazy quotes", async () => {
  const csvData = 'name,description\nAlice,"She said "hello" to me"\nBob,Normal text';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ lazyQuotes: true }))
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", 'She said "hello" to me'],
      ["Bob", "Normal text"]
    ]
  ]);
});

Deno.test("CSV - fields per record validation", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA"; // All rows have correct field count
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ fieldsPerRecord: 3 }))
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ]);
});

Deno.test("CSV - empty input", async () => {
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, []);
});

Deno.test("CSV - empty lines", async () => {
  const csvData = "name,age\n\nAlice,30\n\nBob,25\n\n";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ]);
});

Deno.test("CSV - stringify basic", async () => {
  const data = [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ];
  
  const result = await enumerate(data)
    .transform(toCsv())
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name,age\r\nAlice,30\r\nBob,25\r\n");
});

Deno.test("CSV - stringify with custom separator", async () => {
  const data = [
    [["name", "age"], ["Alice", "30"]]
  ];
  
  const result = await enumerate(data)
    .transform(toCsv({ separator: ";" }))
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText.includes("name;age"), true);
  assertEquals(csvText.includes("Alice;30"), true);
});

Deno.test("CSV - stringify with quotes", async () => {
  const data = [
    [["name", "description"], ["Alice", "Has, comma"], ["Bob", 'Has "quotes"']]
  ];
  
  const result = await enumerate(data)
    .transform(toCsv())
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText.includes('"Has, comma"'), true);
  assertEquals(csvText.includes('"Has ""quotes"""'), true);
});

Deno.test("CSV - stringify from LazyRows", async () => {
  const csvData = "Alice,30\nBob,25";
  
  // First parse to LazyRows
  const lazyRows = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();
  
  // Then stringify back
  const result = await enumerate(lazyRows)
    .transform(toCsv())
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "Alice,30\r\nBob,25\r\n");
});

Deno.test("CSV - round trip", async () => {
  const originalData = [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ];
  
  // Convert to CSV bytes
  const csvBytes = await enumerate(originalData)
    .transform(toCsv())
    .collect();
  
  // Parse back to data
  const parsedData = await enumerate(csvBytes)
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(parsedData, originalData);
});

Deno.test("CSV - multi-byte UTF-8 handling", async () => {
  const csvData = "name,city,emoji\n北京,中国,🏙️\nTokyo,日本,🗾\nParis,France,🇫🇷";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [
      ["name", "city", "emoji"],
      ["北京", "中国", "🏙️"],
      ["Tokyo", "日本", "🗾"],
      ["Paris", "France", "🇫🇷"]
    ]
  ]);
});

Deno.test("CSV - multi-byte UTF-8 in quoted fields", async () => {
  const csvData = 'name,description\n"北京","首都 of 中国"\n"Tokyo","Capital with 🗾 emoji"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["北京", "首都 of 中国"],
      ["Tokyo", "Capital with 🗾 emoji"]
    ]
  ]);
});

Deno.test("CSV - multi-byte UTF-8 chunked at boundaries", async () => {
  // Split multi-byte character across chunks
  const text = "name,city\n北京,中国";
  const bytes = new TextEncoder().encode(text);
  
  // Split at a position that breaks a multi-byte character
  const chunk1 = bytes.slice(0, 12); // Should break in the middle of 北
  const chunk2 = bytes.slice(12);
  
  const result = await enumerate([chunk1, chunk2])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result, [
    [["name", "city"], ["北京", "中国"]]
  ]);
});

Deno.test("CSV - LazyRow selective access", async () => {
  const csvData = "name,age,city,country,continent\nAlice,30,NYC,USA,North America\nBob,25,LA,USA,North America";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();
  
  const rows = result[0];
  
  // Test selective access - only get name and city (indices 0 and 2)
  assertEquals(rows[1].getField(0), "Alice"); // name
  assertEquals(rows[1].getField(2), "NYC");   // city
  assertEquals(rows[2].getField(0), "Bob");   // name  
  assertEquals(rows[2].getField(2), "LA");    // city
  
  // Verify we can still get all fields if needed
  assertEquals(rows[1].toStringArray(), ["Alice", "30", "NYC", "USA", "North America"]);
});

// Error handling tests
Deno.test("CSV - invalid UTF-8 throws", async () => {
  // Create invalid UTF-8 sequence
  const invalidUtf8 = new Uint8Array([0xFF, 0xFE, 0xFD]); // Invalid UTF-8 bytes
  
  try {
    const result = enumerate([invalidUtf8]).transform(fromCsvToRows());
    for await (const batch of result) {
      // Should throw before we get here
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(error instanceof TypeError, true);
  }
});

Deno.test("CSV - malformed quotes throw", async () => {
  const csvData = 'name,description\n"Alice,"Unclosed quote\nBob,Normal';
  
  try {
    const result = enumerate([new TextEncoder().encode(csvData)])
      .transform(fromCsvToRows());
    for await (const batch of result) {
      // Should throw
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(error instanceof SyntaxError, true);
  }
});

Deno.test("CSV - fields per record mismatch throws", async () => {
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25"; // Missing city for Bob
  
  try {
    const result = enumerate([new TextEncoder().encode(csvData)])
      .transform(fromCsvToRows({ fieldsPerRecord: 3 }));
    for await (const batch of result) {
      // Should throw
    }
    throw new Error("Expected error to be thrown");
  } catch (error) {
    assertEquals(error instanceof SyntaxError, true);
  }
});

Deno.test("CSV - invalid separator in quotes", async () => {
  // Test edge case with separator inside quotes
  const csvData = 'name;description\n"Alice";"Has ; semicolon but valid"\n"Bob";"Also ; valid"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows({ separator: ";" }))
    .collect();
  
  // Should parse correctly
  assertEquals(result[0][1][1], "Has ; semicolon but valid");
});

// =============================================================================
// Pathological Data Tests
// =============================================================================

/** Generate random alphanumeric string of given length */
function randomString(len: number): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const result = new Array<string>(len);
  for (let i = 0; i < len; i++) {
    result[i] = chars[Math.floor(Math.random() * chars.length)];
  }
  return result.join("");
}

Deno.test("CSV pathological - 1MB field", async () => {
  const hugeField = randomString(1_000_000);
  const csvData = `small,${hugeField},end\n`;
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result.length, 1);
  assertEquals(result[0][0][0], "small");
  assertEquals(result[0][0][1], hugeField);
  assertEquals(result[0][0][2], "end");
});

Deno.test("CSV pathological - 1MB quoted field", async () => {
  const hugeField = randomString(1_000_000);
  const csvData = `"${hugeField}"\n`;
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result[0][0][0], hugeField);
});

Deno.test("CSV pathological - many fields (100 columns)", async () => {
  const fields = Array.from({ length: 100 }, (_, i) => `field${i}`);
  const csvData = fields.join(",") + "\n";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result[0][0].length, 100);
  assertEquals(result[0][0][0], "field0");
  assertEquals(result[0][0][99], "field99");
});

Deno.test("CSV pathological - many rows (10000 rows)", async () => {
  const rows = Array.from({ length: 10000 }, (_, i) => `a${i},b${i},c${i}`);
  const csvData = rows.join("\n") + "\n";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToRows())
    .collect();
  
  const allRows = result.flat();
  assertEquals(allRows.length, 10000);
  assertEquals(allRows[0], ["a0", "b0", "c0"]);
  assertEquals(allRows[9999], ["a9999", "b9999", "c9999"]);
});

Deno.test("CSV pathological - 1MB field round-trip", async () => {
  const hugeField = randomString(1_000_000);
  const originalData = [[["small", hugeField, "end"]]];
  
  const csvBytes = await enumerate(originalData)
    .transform(toCsv())
    .collect();
  
  const parsedData = await enumerate(csvBytes)
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(parsedData[0][0][1], hugeField);
});

Deno.test("CSV pathological - 1MB field to LazyRow", async () => {
  const hugeField = randomString(1_000_000);
  const csvData = `small,${hugeField},end\n`;
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvToLazyRows())
    .collect();
  
  assertEquals(result[0][0].getField(0), "small");
  assertEquals(result[0][0].getField(1), hugeField);
  assertEquals(result[0][0].getField(2), "end");
});

Deno.test("CSV pathological - chunk boundary in middle of field", async () => {
  const field = "a".repeat(100);
  const csvData = `${field},${field}\n`;
  const bytes = new TextEncoder().encode(csvData);
  
  // Split in middle of first field
  const chunk1 = bytes.slice(0, 50);
  const chunk2 = bytes.slice(50);
  
  const result = await enumerate([chunk1, chunk2])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result[0][0][0], field);
  assertEquals(result[0][0][1], field);
});

Deno.test("CSV pathological - chunk boundary in quoted field", async () => {
  const field = "a".repeat(100);
  const csvData = `"${field}","${field}"\n`;
  const bytes = new TextEncoder().encode(csvData);
  
  // Split in middle of quoted field
  const chunk1 = bytes.slice(0, 60);
  const chunk2 = bytes.slice(60);
  
  const result = await enumerate([chunk1, chunk2])
    .transform(fromCsvToRows())
    .collect();
  
  assertEquals(result[0][0][0], field);
  assertEquals(result[0][0][1], field);
});

Deno.test("CSV pathological - many small chunks", async () => {
  const csvData = "a,b,c\nd,e,f\ng,h,i\n";
  const bytes = new TextEncoder().encode(csvData);
  
  // Split into 1-byte chunks
  const chunks = Array.from(bytes).map(b => new Uint8Array([b]));
  
  const result = await enumerate(chunks)
    .transform(fromCsvToRows())
    .collect();
  
  const allRows = result.flat();
  assertEquals(allRows.length, 3);
  assertEquals(allRows[0], ["a", "b", "c"]);
});
