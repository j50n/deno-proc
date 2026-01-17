import { assertEquals } from "@std/assert";

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
// tsv2csv Parameter Tests
// =============================================================================

Deno.test("tsv2csv - custom separator (semicolon)", async () => {
  const out = await run(["tsv2csv", "-d", ";"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a;b;c\n1;2;3\n");
});

Deno.test("tsv2csv - custom separator (pipe)", async () => {
  const out = await run(["tsv2csv", "-d", "|"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a|b|c\n1|2|3\n");
});

Deno.test("tsv2csv - alwaysQuote=false (default)", async () => {
  const out = await run(["tsv2csv"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("tsv2csv - alwaysQuote=true", async () => {
  const out = await run(["tsv2csv", "--always-quote"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, '"a","b","c"\n"1","2","3"\n');
});

Deno.test("tsv2csv - field with comma needs quoting", async () => {
  const out = await run(["tsv2csv"], "hello, world\ttest\n");
  assertEquals(out, '"hello, world",test\n');
});

Deno.test("tsv2csv - field with quote needs quoting and escaping", async () => {
  const out = await run(["tsv2csv"], 'say "hi"\tok\n');
  assertEquals(out, '"say ""hi""",ok\n');
});

Deno.test("tsv2csv - CRLF line endings", async () => {
  const out = await run(["tsv2csv", "--crlf"], "a\tb\tc\n1\t2\t3\n");
  assertEquals(out, "a,b,c\r\n1,2,3\r\n");
});

Deno.test("tsv2csv - custom separator + alwaysQuote", async () => {
  const out = await run(["tsv2csv", "-d", ";", "--always-quote"], "a\tb\tc\n");
  assertEquals(out, '"a";"b";"c"\n');
});

Deno.test("tsv2csv - custom separator + CRLF", async () => {
  const out = await run(["tsv2csv", "-d", ";", "--crlf"], "a\tb\tc\n");
  assertEquals(out, "a;b;c\r\n");
});

Deno.test("tsv2csv - all parameters combined", async () => {
  const out = await run(
    ["tsv2csv", "-d", "|", "--always-quote", "--crlf"],
    "a\tb\tc\n",
  );
  assertEquals(out, '"a"|"b"|"c"\r\n');
});

// =============================================================================
// record2csv Parameter Tests
// =============================================================================

Deno.test("record2csv - custom separator (semicolon)", async () => {
  const out = await run(
    ["record2csv", "-d", ";"],
    "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E",
  );
  assertEquals(out, "a;b;c\n1;2;3\n");
});

Deno.test("record2csv - custom separator (pipe)", async () => {
  const out = await run(
    ["record2csv", "-d", "|"],
    "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E",
  );
  assertEquals(out, "a|b|c\n1|2|3\n");
});

Deno.test("record2csv - alwaysQuote=false (default)", async () => {
  const out = await run(["record2csv"], "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E");
  assertEquals(out, "a,b,c\n1,2,3\n");
});

Deno.test("record2csv - alwaysQuote=true", async () => {
  const out = await run(
    ["record2csv", "--always-quote"],
    "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E",
  );
  assertEquals(out, '"a","b","c"\n"1","2","3"\n');
});

Deno.test("record2csv - field with comma needs quoting", async () => {
  const out = await run(["record2csv"], "hello, world\x1Ftest\x1E");
  assertEquals(out, '"hello, world",test\n');
});

Deno.test("record2csv - field with quote needs quoting and escaping", async () => {
  const out = await run(["record2csv"], 'say "hi"\x1Fok\x1E');
  assertEquals(out, '"say ""hi""",ok\n');
});

Deno.test("record2csv - CRLF line endings", async () => {
  const out = await run(
    ["record2csv", "--crlf"],
    "a\x1Fb\x1Fc\x1E1\x1F2\x1F3\x1E",
  );
  assertEquals(out, "a,b,c\r\n1,2,3\r\n");
});

Deno.test("record2csv - custom separator + alwaysQuote", async () => {
  const out = await run(
    ["record2csv", "-d", ";", "--always-quote"],
    "a\x1Fb\x1Fc\x1E",
  );
  assertEquals(out, '"a";"b";"c"\n');
});

Deno.test("record2csv - custom separator + CRLF", async () => {
  const out = await run(["record2csv", "-d", ";", "--crlf"], "a\x1Fb\x1Fc\x1E");
  assertEquals(out, "a;b;c\r\n");
});

Deno.test("record2csv - all parameters combined", async () => {
  const out = await run(
    ["record2csv", "-d", "|", "--always-quote", "--crlf"],
    "a\x1Fb\x1Fc\x1E",
  );
  assertEquals(out, '"a"|"b"|"c"\r\n');
});

// =============================================================================
// Edge Cases
// =============================================================================

Deno.test("tsv2csv - empty fields with alwaysQuote", async () => {
  const out = await run(["tsv2csv", "--always-quote"], "a\t\tc\n");
  assertEquals(out, '"a","","c"\n');
});

Deno.test("record2csv - empty fields with alwaysQuote", async () => {
  const out = await run(["record2csv", "--always-quote"], "a\x1F\x1Fc\x1E");
  assertEquals(out, '"a","","c"\n');
});

Deno.test("tsv2csv - field with newline needs quoting", async () => {
  // Note: TSV treats newlines as record separators, so this is two records
  const out = await run(["tsv2csv"], "line1\nline2\tb\n");
  assertEquals(out, "line1\nline2,b\n");
});

Deno.test("record2csv - field with embedded newline needs quoting", async () => {
  const out = await run(["record2csv"], "line1\nline2\x1Fb\x1E");
  assertEquals(out, '"line1\nline2",b\n');
});
