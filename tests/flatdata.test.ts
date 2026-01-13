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
