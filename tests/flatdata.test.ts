/**
 * Comprehensive integration tests for flatdata CLI tool.
 *
 * Tests all 6 format conversion commands:
 * - csv2record, csv2tsv
 * - tsv2record, tsv2csv
 * - record2csv, record2tsv
 *
 * @module
 */

import { assertEquals, assertStringIncludes } from "@std/assert";

const FLATDATA =
  new URL("../scripts/flatdata/flatdata.ts", import.meta.url).pathname;

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
  // Direct WASM parser correctly unescapes quotes
  assertEquals(out, 'say "hi"\tok\n');
});

Deno.test("csv2tsv - custom separator", async () => {
  const out = await run(["csv2tsv", "-d", ";"], "a;b;c\n");
  assertEquals(out, "a\tb\tc\n");
});

Deno.test("csv2tsv - empty fields", async () => {
  const out = await run(["csv2tsv"], "a,,c\n");
  assertEquals(out, "a\t\tc\n");
});

Deno.test("csv2tsv - multiline field is refused, since TSV can't hold it", async () => {
  const proc = new Deno.Command("deno", {
    args: ["run", "--allow-read", FLATDATA, "csv2tsv"],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
  }).spawn();
  const writer = proc.stdin.getWriter();
  await writer.write(new TextEncoder().encode('"line1\nline2",b\n'));
  await writer.close();
  const { code, stderr } = await proc.output();
  assertEquals(code, 1);
  assertStringIncludes(
    new TextDecoder().decode(stderr),
    "Invalid character (LF) in TSV data at row 1, field 1",
  );
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
// tsv2csv Tests
// =============================================================================

Deno.test("tsv2csv - basic conversion", async () => {
  const out = await run(["tsv2csv"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("tsv2csv - fields needing quotes", async () => {
  // Fields with commas should be quoted per RFC 4180
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
  // Quotes should be escaped per RFC 4180
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
  // WASM implementation properly quotes fields containing separators
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
  // WASM implementation properly escapes quotes by doubling them
  const out = await run(["record2csv"], 'say "hi"\x1Fok\x1E');
  assertEquals(out, '"say ""hi""",ok\n');
});

Deno.test("record2csv - newlines in field", async () => {
  // WASM implementation properly quotes fields containing newlines
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
// Cross-Format Round-Trip Tests
// =============================================================================

Deno.test("round-trip: csv -> record -> csv", async () => {
  // WASM implementation properly preserves CSV quoting in round-trips
  const csv = 'name,value\n"hello, world",123\n';
  const record = await run(["csv2record"], csv);
  const back = await run(["record2csv"], record);
  // Quoting is preserved
  assertEquals(back, 'name,value\n"hello, world",123\n');
});

Deno.test("round-trip: csv -> tsv -> csv", async () => {
  // TSV doesn't have quoting, but tsv2csv will add quotes per RFC 4180
  // when fields contain commas
  const csv = 'name,value\n"hello, world",123\n';
  const tsv = await run(["csv2tsv"], csv);
  const back = await run(["tsv2csv"], tsv);
  // Quotes are re-added because the field contains a comma
  assertEquals(back, 'name,value\n"hello, world",123\n');
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

// =============================================================================
// Pathological Data Tests (1MB+ fields)
// =============================================================================

import { enumerate } from "../mod.ts";

/** Generate random alphanumeric string of given length */
function randomString(len: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const result = new Array<string>(len);
  const chunkSize = 65536;
  let pos = 0;
  while (pos < len) {
    const size = Math.min(chunkSize, len - pos);
    const arr = new Uint8Array(size);
    crypto.getRandomValues(arr);
    for (let j = 0; j < size; j++) {
      result[pos++] = chars[arr[j] % chars.length];
    }
  }
  return result.join("");
}

const HUGE_FIELD = randomString(1_000_000);

// Helper to collect raw bytes from a stream
async function collectBytes(
  stream: AsyncIterable<Uint8Array>,
): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return new TextDecoder().decode(result);
}

Deno.test("pathological: csv2record with 1MB field", async () => {
  const csv = `small,${HUGE_FIELD},end\n`;
  const result = await collectBytes(
    enumerate([new TextEncoder().encode(csv)])
      .run("deno", "run", "--allow-read", FLATDATA, "csv2record"),
  );
  assertEquals(result, `small\x1F${HUGE_FIELD}\x1Fend\x1E`);
});

Deno.test("pathological: csv2tsv with 1MB field", async () => {
  const csv = `small,${HUGE_FIELD},end\n`;
  const lines = await enumerate([new TextEncoder().encode(csv)])
    .run("deno", "run", "--allow-read", FLATDATA, "csv2tsv")
    .lines.collect();
  assertEquals(lines.join("\n") + "\n", `small\t${HUGE_FIELD}\tend\n`);
});

Deno.test("pathological: tsv2record with 1MB field", async () => {
  const tsv = `small\t${HUGE_FIELD}\tend\n`;
  const result = await collectBytes(
    enumerate([new TextEncoder().encode(tsv)])
      .run("deno", "run", "--allow-read", FLATDATA, "tsv2record"),
  );
  assertEquals(result, `small\x1F${HUGE_FIELD}\x1Fend\x1E`);
});

Deno.test("pathological: tsv2csv with 1MB field", async () => {
  const tsv = `small\t${HUGE_FIELD}\tend\n`;
  const lines = await enumerate([new TextEncoder().encode(tsv)])
    .run("deno", "run", "--allow-read", FLATDATA, "tsv2csv")
    .lines.collect();
  assertEquals(lines.join("\n") + "\n", `small,${HUGE_FIELD},end\n`);
});

Deno.test("pathological: record2csv with 1MB field", async () => {
  const record = `small\x1F${HUGE_FIELD}\x1Fend\x1E`;
  const lines = await enumerate([new TextEncoder().encode(record)])
    .run("deno", "run", "--allow-read", FLATDATA, "record2csv")
    .lines.collect();
  assertEquals(lines.join("\n") + "\n", `small,${HUGE_FIELD},end\n`);
});

Deno.test("pathological: record2tsv with 1MB field", async () => {
  const record = `small\x1F${HUGE_FIELD}\x1Fend\x1E`;
  const lines = await enumerate([new TextEncoder().encode(record)])
    .run("deno", "run", "--allow-read", FLATDATA, "record2tsv")
    .lines.collect();
  assertEquals(lines.join("\n") + "\n", `small\t${HUGE_FIELD}\tend\n`);
});

Deno.test("pathological: multiple 1MB fields in one row", async () => {
  const huge1 = randomString(1_000_000);
  const huge2 = randomString(1_000_000);
  const csv = `${huge1},${huge2}\n`;
  const result = await collectBytes(
    enumerate([new TextEncoder().encode(csv)])
      .run("deno", "run", "--allow-read", FLATDATA, "csv2record"),
  );
  assertEquals(result, `${huge1}\x1F${huge2}\x1E`);
});

Deno.test("pathological: 1MB field with normal rows before and after", async () => {
  const csv = `a,b,c\n${HUGE_FIELD},small,end\nx,y,z\n`;
  const lines = await enumerate([new TextEncoder().encode(csv)])
    .run("deno", "run", "--allow-read", FLATDATA, "csv2record")
    .run("deno", "run", "--allow-read", FLATDATA, "record2csv")
    .lines.collect();
  assertEquals(lines.join("\n") + "\n", csv);
});
