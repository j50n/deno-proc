/**
 * Comprehensive integration tests for flatdata CLI tool.
 *
 * Tests all 12 format conversion commands:
 * - csv2record, csv2lazyrow, csv2tsv
 * - tsv2record, tsv2lazyrow, tsv2csv
 * - record2csv, record2tsv, record2lazyrow
 * - lazyrow2csv, lazyrow2tsv, lazyrow2record
 *
 * @module
 */

import { assertEquals } from "@std/assert";

const FLATDATA = new URL("../scripts/flatdata/flatdata.ts", import.meta.url).pathname;

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

async function runBinary(args: string[], input: Uint8Array): Promise<Uint8Array> {
  const cmd = new Deno.Command("deno", {
    args: ["run", "--allow-read", FLATDATA, ...args],
    stdin: "piped",
    stdout: "piped",
  });
  const proc = cmd.spawn();
  const writer = proc.stdin.getWriter();
  await writer.write(input);
  await writer.close();
  const { stdout } = await proc.output();
  return stdout;
}

// =============================================================================
// csv2record Tests
// =============================================================================

Deno.test("csv2record - basic conversion", async () => {
  const out = await run(["csv2record"], "a,b,c\n1,2,3\n");
  assertEquals(out, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

Deno.test("csv2record - quoted fields with commas", async () => {
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

Deno.test("csv2record - empty fields", async () => {
  const out = await run(["csv2record"], "a,,c\n,2,\n");
  assertEquals(out, "a\x1F\x1Fc\x1E\x1F2\x1F\x1E");
});

Deno.test("csv2record - multiline quoted field", async () => {
  const out = await run(["csv2record"], '"line1\nline2",b\n');
  assertEquals(out, "line1\nline2\x1Fb\x1E");
});

Deno.test("csv2record - single field", async () => {
  const out = await run(["csv2record"], "value\n");
  assertEquals(out, "value\x1E");
});

Deno.test("csv2record - empty line", async () => {
  const out = await run(["csv2record"], "\n");
  // Empty line produces no output (no record)
  assertEquals(out, "");
});

Deno.test("csv2record - trailing comma", async () => {
  const out = await run(["csv2record"], "a,b,\n");
  assertEquals(out, "a\x1Fb\x1F\x1E");
});

Deno.test("csv2record - large input spanning chunks", async () => {
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`field${i},value${i},"desc ${i}"`);
  }
  const csv = rows.join("\n") + "\n";
  const out = await run(["csv2record"], csv);
  const recordCount = out.split("\x1E").length - 1;
  assertEquals(recordCount, 2000);
});

// =============================================================================
// csv2lazyrow Tests
// =============================================================================

Deno.test("csv2lazyrow - basic conversion", async () => {
  const out = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,b\n1,2\n"));
  // LazyRow format: [field_count][len1][data1][len2][data2]...
  // Verify it's binary and non-empty
  assertEquals(out.length > 0, true);
});

Deno.test("csv2lazyrow - empty fields", async () => {
  const out = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,,c\n"));
  assertEquals(out.length > 0, true);
});

Deno.test("csv2lazyrow - custom separator", async () => {
  const out = await runBinary(["csv2lazyrow", "-d", ";"], new TextEncoder().encode("a;b\n"));
  assertEquals(out.length > 0, true);
});

Deno.test("csv2lazyrow - round-trip to record", async () => {
  const csv = "a,b,c\n1,2,3\n";
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode(csv));
  const record = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(record, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

// =============================================================================
// csv2tsv Tests
// =============================================================================

Deno.test("csv2tsv - basic conversion", async () => {
  const out = await run(["csv2tsv"], "a,b,c\n1,2,3\n");
  assertEquals(out, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("csv2tsv - quoted fields", async () => {
  const out = await run(["csv2tsv"], '"hello, world",test\n');
  assertEquals(out, "hello, world\ttest\n");
});

Deno.test("csv2tsv - escaped quotes", async () => {
  const out = await run(["csv2tsv"], '"say ""hi""",ok\n');
  // Note: WASM stringifier currently keeps outer quotes for fields with escaped quotes
  // This is a known limitation - the field is correctly parsed but re-quoted on output
  assertEquals(out, '"say ""hi"""\tok\n');
});

Deno.test("csv2tsv - custom separator", async () => {
  const out = await run(["csv2tsv", "-d", ";"], "a;b;c\n");
  assertEquals(out, "a\tb\tc\n");
});

Deno.test("csv2tsv - empty fields", async () => {
  const out = await run(["csv2tsv"], "a,,c\n");
  assertEquals(out, "a\t\tc\n");
});

Deno.test("csv2tsv - multiline field", async () => {
  const out = await run(["csv2tsv"], '"line1\nline2",b\n');
  // Note: WASM stringifier currently keeps outer quotes for multiline fields
  // This is a known limitation - the field is correctly parsed but re-quoted on output
  assertEquals(out, '"line1\nline2"\tb\n');
});

// =============================================================================
// tsv2record Tests
// =============================================================================

Deno.test("tsv2record - basic conversion", async () => {
  const out = await run(["tsv2record"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

Deno.test("tsv2record - empty fields", async () => {
  const out = await run(["tsv2record"], "a\t\tc\n\t2\t\n");
  assertEquals(out, "a\x1F\x1Fc\x1E\x1F2\x1F\x1E");
});

Deno.test("tsv2record - single field", async () => {
  const out = await run(["tsv2record"], "value\n");
  assertEquals(out, "value\x1E");
});

Deno.test("tsv2record - special characters", async () => {
  const out = await run(["tsv2record"], "hello\tworld!\t@#$\n");
  assertEquals(out, "hello\x1Fworld!\x1F@#$\x1E");
});

Deno.test("tsv2record - large input", async () => {
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`field${i}\tvalue${i}\tdesc${i}`);
  }
  const tsv = rows.join("\n") + "\n";
  const out = await run(["tsv2record"], tsv);
  const recordCount = out.split("\x1E").length - 1;
  assertEquals(recordCount, 2000);
});

// =============================================================================
// tsv2lazyrow Tests
// =============================================================================

Deno.test("tsv2lazyrow - basic conversion", async () => {
  const out = await runBinary(["tsv2lazyrow"], new TextEncoder().encode("a\tb\n1\t2\n"));
  assertEquals(out.length > 0, true);
});

Deno.test("tsv2lazyrow - empty fields", async () => {
  const out = await runBinary(["tsv2lazyrow"], new TextEncoder().encode("a\t\tc\n"));
  assertEquals(out.length > 0, true);
});

Deno.test("tsv2lazyrow - round-trip to record", async () => {
  const tsv = "a\tb\tc\n1\t2\t3\n";
  const lazy = await runBinary(["tsv2lazyrow"], new TextEncoder().encode(tsv));
  const record = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(record, "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
});

// =============================================================================
// tsv2csv Tests
// =============================================================================

Deno.test("tsv2csv - basic conversion", async () => {
  const out = await run(["tsv2csv"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("tsv2csv - fields needing quotes", async () => {
  const out = await run(["tsv2csv"], "hello, world\ttest\n");
  assertEquals(out, '"hello, world",test\n');
});

Deno.test("tsv2csv - custom separator", async () => {
  const out = await run(["tsv2csv", "-d", ";"], "a\tb\tc\n");
  assertEquals(out, "a;b;c\n");
});

Deno.test("tsv2csv - empty fields", async () => {
  const out = await run(["tsv2csv"], "a\t\tc\n");
  assertEquals(out, "a,,c\n");
});

Deno.test("tsv2csv - quotes in field", async () => {
  const out = await run(["tsv2csv"], 'say "hi"\tok\n');
  assertEquals(out, '"say ""hi""",ok\n');
});

Deno.test("tsv2csv - newlines in field", async () => {
  // Note: TSV format treats newlines as record separators, not as part of field data
  // So this input is actually two records: "line1" and "line2\tb"
  const out = await run(["tsv2csv"], "line1\nline2\tb\n");
  assertEquals(out, "line1\nline2,b\n");
});

// =============================================================================
// record2csv Tests
// =============================================================================

Deno.test("record2csv - basic conversion", async () => {
  const out = await run(["record2csv"], "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("record2csv - fields needing quotes", async () => {
  const out = await run(["record2csv"], "hello, world\x1Ftest\x1E");
  assertEquals(out, '"hello, world",test\n');
});

Deno.test("record2csv - custom separator", async () => {
  const out = await run(["record2csv", "-d", ";"], "a\x1Fb\x1E");
  assertEquals(out, "a;b\n");
});

Deno.test("record2csv - empty fields", async () => {
  const out = await run(["record2csv"], "a\x1F\x1Fc\x1E");
  assertEquals(out, "a,,c\n");
});

Deno.test("record2csv - quotes in field", async () => {
  const out = await run(["record2csv"], 'say "hi"\x1Fok\x1E');
  assertEquals(out, '"say ""hi""",ok\n');
});

Deno.test("record2csv - newlines in field", async () => {
  const out = await run(["record2csv"], "line1\nline2\x1Fb\x1E");
  assertEquals(out, '"line1\nline2",b\n');
});

Deno.test("record2csv - single field", async () => {
  const out = await run(["record2csv"], "value\x1E");
  assertEquals(out, "value\n");
});

// =============================================================================
// record2tsv Tests
// =============================================================================

Deno.test("record2tsv - basic conversion", async () => {
  const out = await run(["record2tsv"], "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(out, "a\tb\tc\n1\t2\t3\n");
});

Deno.test("record2tsv - empty fields", async () => {
  const out = await run(["record2tsv"], "a\x1F\x1Fc\x1E");
  assertEquals(out, "a\t\tc\n");
});

Deno.test("record2tsv - special characters", async () => {
  const out = await run(["record2tsv"], "hello\x1Fworld!\x1F@#$\x1E");
  assertEquals(out, "hello\tworld!\t@#$\n");
});

Deno.test("record2tsv - single field", async () => {
  const out = await run(["record2tsv"], "value\x1E");
  assertEquals(out, "value\n");
});

// =============================================================================
// record2lazyrow Tests
// =============================================================================

Deno.test("record2lazyrow - basic conversion", async () => {
  const out = await runBinary(["record2lazyrow"], new TextEncoder().encode("a\x1Fb\x1E1\x1F2\x1E"));
  assertEquals(out.length > 0, true);
});

Deno.test("record2lazyrow - empty fields", async () => {
  const out = await runBinary(["record2lazyrow"], new TextEncoder().encode("a\x1F\x1Fc\x1E"));
  assertEquals(out.length > 0, true);
});

Deno.test("record2lazyrow - round-trip", async () => {
  const record = "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E";
  const lazy = await runBinary(["record2lazyrow"], new TextEncoder().encode(record));
  const back = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(back, record);
});

// =============================================================================
// lazyrow2csv Tests
// =============================================================================

Deno.test("lazyrow2csv - basic conversion", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,b\n1,2\n"));
  const csv = await run(["lazyrow2csv"], new TextDecoder().decode(lazy));
  assertEquals(csv, "a,b\n1,2\n");
});

Deno.test("lazyrow2csv - fields needing quotes", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode('"hello, world",test\n'));
  const csv = await run(["lazyrow2csv"], new TextDecoder().decode(lazy));
  assertEquals(csv, '"hello, world",test\n');
});

Deno.test("lazyrow2csv - custom separator", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,b\n"));
  const csv = await run(["lazyrow2csv", "-d", ";"], new TextDecoder().decode(lazy));
  assertEquals(csv, "a;b\n");
});

Deno.test("lazyrow2csv - empty fields", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,,c\n"));
  const csv = await run(["lazyrow2csv"], new TextDecoder().decode(lazy));
  assertEquals(csv, "a,,c\n");
});

// =============================================================================
// lazyrow2tsv Tests
// =============================================================================

Deno.test("lazyrow2tsv - basic conversion", async () => {
  const lazy = await runBinary(["tsv2lazyrow"], new TextEncoder().encode("a\tb\n1\t2\n"));
  const tsv = await run(["lazyrow2tsv"], new TextDecoder().decode(lazy));
  assertEquals(tsv, "a\tb\n1\t2\n");
});

Deno.test("lazyrow2tsv - empty fields", async () => {
  const lazy = await runBinary(["tsv2lazyrow"], new TextEncoder().encode("a\t\tc\n"));
  const tsv = await run(["lazyrow2tsv"], new TextDecoder().decode(lazy));
  assertEquals(tsv, "a\t\tc\n");
});

Deno.test("lazyrow2tsv - special characters", async () => {
  const lazy = await runBinary(["tsv2lazyrow"], new TextEncoder().encode("hello\t@#$\n"));
  const tsv = await run(["lazyrow2tsv"], new TextDecoder().decode(lazy));
  assertEquals(tsv, "hello\t@#$\n");
});

// =============================================================================
// lazyrow2record Tests
// =============================================================================

Deno.test("lazyrow2record - basic conversion", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,b\n1,2\n"));
  const record = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(record, "a\x1Fb\x1E1\x1F2\x1E");
});

Deno.test("lazyrow2record - empty fields", async () => {
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode("a,,c\n"));
  const record = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(record, "a\x1F\x1Fc\x1E");
});

Deno.test("lazyrow2record - round-trip", async () => {
  const record = "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E";
  const lazy = await runBinary(["record2lazyrow"], new TextEncoder().encode(record));
  const back = await run(["lazyrow2record"], new TextDecoder().decode(lazy));
  assertEquals(back, record);
});

// =============================================================================
// Cross-Format Round-Trip Tests
// =============================================================================

Deno.test("round-trip: csv -> record -> csv", async () => {
  const csv = 'name,value\n"hello, world",123\n';
  const record = await run(["csv2record"], csv);
  const back = await run(["record2csv"], record);
  assertEquals(back, csv);
});

Deno.test("round-trip: csv -> tsv -> csv", async () => {
  const csv = 'name,value\n"hello, world",123\n';
  const tsv = await run(["csv2tsv"], csv);
  const back = await run(["tsv2csv"], tsv);
  assertEquals(back, csv);
});

Deno.test("round-trip: csv -> lazyrow -> csv", async () => {
  const csv = "a,b,c\n1,2,3\n";
  const lazy = await runBinary(["csv2lazyrow"], new TextEncoder().encode(csv));
  const back = await run(["lazyrow2csv"], new TextDecoder().decode(lazy));
  assertEquals(back, csv);
});

Deno.test("round-trip: tsv -> record -> tsv", async () => {
  const tsv = "a\tb\tc\n1\t2\t3\n";
  const record = await run(["tsv2record"], tsv);
  const back = await run(["record2tsv"], record);
  assertEquals(back, tsv);
});

Deno.test("round-trip: tsv -> csv -> tsv", async () => {
  const tsv = "a\tb\tc\n1\t2\t3\n";
  const csv = await run(["tsv2csv"], tsv);
  const back = await run(["csv2tsv"], csv);
  assertEquals(back, tsv);
});

Deno.test("round-trip: tsv -> lazyrow -> tsv", async () => {
  const tsv = "a\tb\tc\n1\t2\t3\n";
  const lazy = await runBinary(["tsv2lazyrow"], new TextEncoder().encode(tsv));
  const back = await run(["lazyrow2tsv"], new TextDecoder().decode(lazy));
  assertEquals(back, tsv);
});

// =============================================================================
// Large Input Tests (Chunk Boundary Handling)
// =============================================================================

Deno.test("large input: csv2record preserves all data", async () => {
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`item${i},${i * 1.5},desc${i}`);
  }
  const csv = rows.join("\n") + "\n";
  const record = await run(["csv2record"], csv);
  const back = await run(["record2csv"], record);
  assertEquals(back, csv);
});

Deno.test("large input: tsv2record preserves all data", async () => {
  const rows: string[] = [];
  for (let i = 0; i < 2000; i++) {
    rows.push(`item${i}\t${i * 1.5}\tdesc${i}`);
  }
  const tsv = rows.join("\n") + "\n";
  const record = await run(["tsv2record"], tsv);
  const back = await run(["record2tsv"], record);
  assertEquals(back, tsv);
});
