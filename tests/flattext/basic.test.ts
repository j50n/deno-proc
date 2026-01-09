import { FlatText } from "../../wasm/flattext-api.ts";
import { assertEquals, assertThrows } from "@std/assert";

let converter: FlatText;

// Setup converter instance for all tests
Deno.test({
  name: "FlatText - Setup converter instance",
  async fn() {
    converter = await FlatText.create();
  },
});

// Basic CSV to TSV conversion
Deno.test({
  name: "FlatText - Basic CSV to TSV conversion",
  async fn() {
    const result = converter.csvToTsv("a,b,c\n1,2,3");
    assertEquals(result, "a\tb\tc\n1\t2\t3\n");
  },
});

// Empty input
Deno.test({
  name: "FlatText - Empty input",
  async fn() {
    const result = converter.csvToTsv("");
    assertEquals(result, "");
  },
});

// Single field
Deno.test({
  name: "FlatText - Single field",
  async fn() {
    const result = converter.csvToTsv("hello");
    assertEquals(result, "hello\n");
  },
});

// Quoted fields with commas
Deno.test({
  name: "FlatText - Quoted fields with embedded commas",
  async fn() {
    const result = converter.csvToTsv('name,"last, first",age\n"Smith, John","Doe, Jane",30');
    assertEquals(result, "name\tlast, first\tage\nSmith, John\tDoe, Jane\t30\n");
  },
});

// Escaped quotes
Deno.test({
  name: "FlatText - Escaped quotes in fields",
  async fn() {
    const result = converter.csvToTsv('name,quote\n"John","He said ""Hello"""\n"Jane","She said ""Hi"""');
    assertEquals(result, 'name\tquote\nJohn\tHe said "Hello"\nJane\tShe said "Hi"\n');
  },
});
