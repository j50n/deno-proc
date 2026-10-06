/**
 * Claims about how the flatdata CLI fails: with a one-line message and exit
 * code 1, never by emptying its own input, and quietly when its reader goes
 * away.
 */

import { assert, assertEquals, assertStringIncludes } from "@std/assert";

const FLATDATA =
  new URL("../../scripts/flatdata/flatdata.ts", import.meta.url).pathname;

async function flatdata(
  args: string[],
  input = "",
): Promise<{ code: number; stdout: string; stderr: string }> {
  const child = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", "--allow-write", FLATDATA, ...args],
    stdin: "piped",
    stdout: "piped",
    stderr: "piped",
    env: { NO_COLOR: "1" },
  }).spawn();
  const writer = child.stdin.getWriter();
  await writer.write(new TextEncoder().encode(input));
  await writer.close();
  const { code, stdout, stderr } = await child.output();
  const decoder = new TextDecoder();
  return {
    code,
    stdout: decoder.decode(stdout),
    stderr: decoder.decode(stderr),
  };
}

Deno.test("flatdata refuses -o naming its input, by any path, and leaves the file as it was.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/data.csv`;
    await Deno.writeTextFile(file, "a,b\n");
    // With ln rather than Deno.symlink, which needs unscoped permissions.
    await new Deno.Command("ln", { args: ["-s", file, `${dir}/link.csv`] })
      .output();
    for (
      const output of [file, `${dir}/./data.csv`, `${dir}/link.csv`]
    ) {
      const { code, stderr } = await flatdata([
        "csv2tsv",
        "-i",
        file,
        "-o",
        output,
      ]);
      assertEquals(code, 1, output);
      assertStringIncludes(stderr, "are the same file");
      assertEquals(await Deno.readTextFile(file), "a,b\n", output);
    }
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("flatdata refuses -o naming the file stdin reads.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/data.csv`;
    await Deno.writeTextFile(file, "a,b\n");
    // `< file`, as a shell does it.
    const { code, stderr } = await new Deno.Command("sh", {
      args: [
        "-c",
        '"$0" run -A "$1" csv2tsv -o "$2" < "$2"',
        Deno.execPath(),
        FLATDATA,
        file,
      ],
      stderr: "piped",
      env: { NO_COLOR: "1" },
    }).output();
    assertEquals(code, 1);
    assertStringIncludes(
      new TextDecoder().decode(stderr),
      "flatdata: stdin and",
    );
    assertEquals(await Deno.readTextFile(file), "a,b\n");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("flatdata reports an error as one line on stderr, with exit code 1.", async () => {
  const cases: [string[], string, string][] = [
    [
      ["csv2tsv"],
      'a,b\n"c\td",e\n',
      "flatdata: Invalid character (tab) in TSV data at row 2, field 1\n",
    ],
    [
      ["csv2record"],
      'a,"b\n',
      "flatdata: Unclosed quote in CSV data at row 1, field 2\n",
    ],
    [
      ["csv2tsv"],
      'a,"b\n',
      "flatdata: Invalid character (LF) in TSV data at row 1, field 2\n",
    ],
    [["csv2tsv"], "a,b\rc\n", "flatdata: Invalid character (CR) in CSV"],
  ];
  for (const [args, input, message] of cases) {
    const { code, stderr } = await flatdata(args, input);
    assertEquals(code, 1, input);
    assert(stderr.startsWith(message), stderr);
    assert(!stderr.includes("    at "), `a stack trace: ${stderr}`);
  }
  const missing = await flatdata(["csv2tsv", "-i", "/nonexistent/in.csv"]);
  assertEquals(missing.code, 1);
  assert(missing.stderr.startsWith("flatdata: "), missing.stderr);
  assertEquals(missing.stderr.trim().split("\n").length, 1);
});

Deno.test("flatdata exits 0, quietly, when the reader of its stdout goes away.", async () => {
  // `| head -1` closes the pipe after the first line; the exit code is
  // flatdata's, from PIPESTATUS.
  const script = `yes 'a,b,c' | head -200000 | "$0" run "$1" csv2tsv ` +
    "| head -1; exit ${PIPESTATUS[2]}";
  const { code, stdout, stderr } = await new Deno.Command("bash", {
    args: ["-c", script, Deno.execPath(), FLATDATA],
    env: { NO_COLOR: "1" },
  }).output();
  const decoder = new TextDecoder();
  assertEquals(decoder.decode(stdout), "a\tb\tc\n");
  assertEquals(decoder.decode(stderr), "");
  assertEquals(code, 0);
});
