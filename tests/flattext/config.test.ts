import { csvToTsv } from "./test-helpers.ts";
import { assertEquals, assertThrows } from "@std/assert";



// Custom delimiter tests
Deno.test({
  name: "Config - Custom delimiter (semicolon)",
  async fn() {
    const result = await csvToTsv("a;b;c\n1;2;3", { delimiter: ";" });
    assertEquals(result, "a\tb\tc\n1\t2\t3\n");
  },
});

Deno.test({
  name: "Config - Custom delimiter (pipe)",
  async fn() {
    const result = await csvToTsv("name|age|city\nAlice|30|NYC", { delimiter: "|" });
    assertEquals(result, "name\tage\tcity\nAlice\t30\tNYC\n");
  },
});

// Comment line tests
Deno.test({
  name: "Config - Comment lines (hash)",
  async fn() {
    const input = "# This is a comment\na,b,c\n# Another comment\n1,2,3";
    const result = await csvToTsv(input, { comment: "#" });
    assertEquals(result, "a\tb\tc\n1\t2\t3\n");
  },
});

Deno.test({
  name: "Config - Comment lines (double slash)",
  async fn() {
    const input = "// Header comment\na,b,c\n1,2,3\n// Footer comment";
    const result = await csvToTsv(input, { comment: "/" });
    assertEquals(result, "a\tb\tc\n1\t2\t3\n");
  },
});

// Trim leading space tests
Deno.test({
  name: "Config - Trim leading spaces",
  async fn() {
    const input = "name,  age  ,   city\nAlice,  30  ,   NYC";
    const result = await csvToTsv(input, { trimLeadingSpace: true });
    assertEquals(result, "name\tage  \tcity\nAlice\t30  \tNYC\n");
  },
});

Deno.test({
  name: "Config - No trim (default behavior)",
  async fn() {
    const input = "name,  age  ,   city\nAlice,  30  ,   NYC";
    const result = await csvToTsv(input, { trimLeadingSpace: false });
    assertEquals(result, "name\t  age  \t   city\nAlice\t  30  \t   NYC\n");
  },
});
