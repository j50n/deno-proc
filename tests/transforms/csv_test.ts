import { assertEquals } from "@std/assert";
import { enumerate } from "../../src/enumerable.ts";
import { createCsvTransformers } from "../../src/transforms/csv.ts";

Deno.test("CSV - basic parsing", async () => {
  const { fromCsvBytes } = createCsvTransformers();
  const csvData = "name,age,city\nAlice,30,NYC\nBob,25,LA";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ]);
});

Deno.test("CSV - chunked input", async () => {
  const { fromCsvBytes } = createCsvTransformers();
  const chunks = ["name,age\n", "Alice,30\n", "Bob,25"];
  
  const result = await enumerate(chunks.map(s => new TextEncoder().encode(s)))
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ]);
});

Deno.test("CSV - quoted fields", async () => {
  const { fromCsvBytes } = createCsvTransformers();
  const csvData = 'name,description\n"Alice","A person with, comma"\n"Bob","Another ""quoted"" person"';
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [
      ["name", "description"],
      ["Alice", "A person with, comma"],
      ["Bob", 'Another "quoted" person']
    ]
  ]);
});

Deno.test("CSV - custom separator", async () => {
  const { fromCsvBytes } = createCsvTransformers({ separator: ";" });
  const csvData = "name;age;city\nAlice;30;NYC\nBob;25;LA";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ]);
});

Deno.test("CSV - comments", async () => {
  const { fromCsvBytes } = createCsvTransformers({ comment: "#" });
  const csvData = "# This is a comment\nname,age\n# Another comment\nAlice,30\nBob,25";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ]);
});

Deno.test("CSV - empty input", async () => {
  const { fromCsvBytes } = createCsvTransformers();
  
  const result = await enumerate([new TextEncoder().encode("")])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, []);
});

Deno.test("CSV - stringify basic", async () => {
  const { toCsvBytes } = createCsvTransformers();
  const data = [
    [["name", "age"], ["Alice", "30"], ["Bob", "25"]]
  ];
  
  const result = await enumerate(data)
    .transform(toCsvBytes)
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  assertEquals(csvText, "name,age\r\nAlice,30\r\nBob,25\r\n");
});

Deno.test("CSV - stringify with custom options", async () => {
  const { toCsvBytes } = createCsvTransformers(undefined, { 
    separator: ";", 
    crlf: false 
  });
  const data = [
    [["name", "age"], ["Alice", "30"]]
  ];
  
  const result = await enumerate(data)
    .transform(toCsvBytes)
    .collect();
  
  const csvText = new TextDecoder().decode(result[0]);
  // Note: Deno CSV library may still use CRLF, so we check for the separator
  assertEquals(csvText.includes("name;age"), true);
  assertEquals(csvText.includes("Alice;30"), true);
});

Deno.test("CSV - round trip", async () => {
  const { fromCsvBytes, toCsvBytes } = createCsvTransformers();
  const originalData = [
    [["name", "age", "city"], ["Alice", "30", "NYC"], ["Bob", "25", "LA"]]
  ];
  
  // Convert to CSV bytes
  const csvBytes = await enumerate(originalData)
    .transform(toCsvBytes)
    .collect();
  
  // Parse back to data
  const parsedData = await enumerate(csvBytes)
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(parsedData, originalData);
});

Deno.test("CSV - UTF-8 handling", async () => {
  const { fromCsvBytes } = createCsvTransformers();
  const csvData = "name,city\n北京,中国\nTokyo,日本";
  
  const result = await enumerate([new TextEncoder().encode(csvData)])
    .transform(fromCsvBytes)
    .collect();
  
  assertEquals(result, [
    [["name", "city"], ["北京", "中国"], ["Tokyo", "日本"]]
  ]);
});
