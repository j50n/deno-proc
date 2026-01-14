/**
 * Integration tests for flatdata CLI tool.
 *
 * Tests the flatdata command-line interface for converting between
 * CSV, TSV, record format, and binary lazyrow format.
 *
 * Test coverage:
 * - CSV/TSV to record format conversions
 * - Record format to CSV/TSV conversions
 * - Custom separators
 * - RFC 4180 quoting and escaping
 * - Round-trip conversions (data integrity)
 * - Large input handling (chunk boundary edge cases)
 *
 * @module
 */

import { assertEquals } from "@std/assert";

const FLATDATA =
  new URL("../scripts/flatdata/flatdata.ts", import.meta.url).pathname;

/**
 * Run flatdata CLI with given arguments and input.
 * @param args - Command-line arguments
 * @param input - Input data as string
 * @returns Output from stdout
 */
async function run(args: string[], input: string): Promise<string> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "--allow-read", FLATDATA, ...args],
    stdin: "piped",
    stdout: "piped",
  });
  const proc = cmd.spawn();
  const writer = proc.stdin.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();
  const { stdout } = await proc.output();
  return new TextDecoder().decode(stdout);
}

// =============================================================================
// CSV to Record Format Tests
// =============================================================================

Deno.test("csv2record - basic", async () => {
  const out = await run(["csv2record"], "a,b,c\n1,2,3\n");
  assertEquals(out, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

Deno.test("csv2record - quoted fields", async () => {
  const out = await run(["csv2record"], '"hello, world",test\n');
  assertEquals(out, "hello, world\x1Ftest\x1E");
});

Deno.test("csv2record - escaped quotes", async () => {
  const out = await run(["csv2record"], '"say ""hello""",ok\n');
  assertEquals(out, 'say "hello"\x1Fok\x1E');
});

Deno.test("csv2record - custom separator", async () => {
  const out = await run(["csv2record", "-d", ";"], "a;b;c\n1;2;3\n");
  assertEquals(out, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

// =============================================================================
// Record to CSV/TSV Format Tests
// =============================================================================

Deno.test("record2csv - basic", async () => {
  const out = await run(["record2csv"], "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("record2csv - needs quoting", async () => {
  const out = await run(["record2csv"], "hello, world\x1Ftest\x1E");
  assertEquals(out, '"hello, world",test\n');
});

Deno.test("record2csv - custom separator", async () => {
  const out = await run(["record2csv", "-d", ";"], "a\x1Fb\x1E");
  assertEquals(out, "a;b\n");
});

Deno.test("record2tsv - basic", async () => {
  const out = await run(["record2tsv"], "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(out, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("tsv2record - basic", async () => {
  const out = await run(["tsv2record"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

// =============================================================================
// Round-Trip Conversion Tests (Data Integrity)
// =============================================================================

Deno.test("roundtrip csv -> record -> csv", async () => {
  const csv = 'name,value\n"hello, world",123\n';
  const record = await run(["csv2record"], csv);
  const back = await run(["record2csv"], record);
  assertEquals(back, csv);
});

Deno.test("roundtrip tsv -> record -> tsv", async () => {
  const tsv = "a\tb\tc\n1\t2\t3\n";
  const record = await run(["tsv2record"], tsv);
  const back = await run(["record2tsv"], record);
  assertEquals(back, tsv);
});

// =============================================================================
// Large Input Tests (Chunk Boundary Handling)
// =============================================================================

// Test for carry buffer bug fix - records spanning chunk boundaries
Deno.test("csv2record - large input with chunk boundaries", async () => {
  // Generate input larger than 64KB chunk size to test carry buffer handling
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`field${i},value${i},"description for row ${i}"`);
  }
  const csv = rows.join("\n") + "\n";

  const out = await run(["csv2record"], csv);

  // Verify correct number of record separators
  const recordCount = out.split("\x1E").length - 1;
  assertEquals(recordCount, 2000);

  // Verify first and last records are correct
  const records = out.split("\x1E").filter((r) => r.length > 0);
  assertEquals(records[0], "field0\x1Fvalue0\x1Fdescription for row 0");
  assertEquals(
    records[1999],
    "field1999\x1Fvalue1999\x1Fdescription for row 1999",
  );
});

Deno.test("roundtrip - large input preserves data", async () => {
  // Generate CSV larger than chunk size
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`item${i},${i * 1.5},desc${i}`);
  }
  const csv = rows.join("\n") + "\n";

  const record = await run(["csv2record"], csv);
  const back = await run(["record2csv"], record);

  assertEquals(back, csv);
});
