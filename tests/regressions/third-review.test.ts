import {
  assert,
  assertEquals,
  assertFalse,
  assertLess,
  assertRejects,
  assertThrows,
} from "@std/assert";
import {
  buffer,
  enumerate,
  range,
  run,
  TimeoutError,
  toBytes,
  type Writable,
} from "../../mod.ts";
import { fromJsonToRows, fromRecordToRows } from "../../src/transforms/mod.ts";

// Found in the third review, after 0.27.0.

const MOD = new URL("../../mod.ts", import.meta.url).href;
const encoder = new TextEncoder();

/** An endless source that records whether it was closed. */
function spy() {
  const state = { closed: false };
  async function* items() {
    try {
      for (let n = 0;; n++) yield n;
    } finally {
      state.closed = true;
    }
  }
  return { state, items: items() };
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function* failing(...items: string[]) {
  yield* items;
  throw new Error("source failed");
}

/** Run `script` in its own Deno, through bash so it can be redirected. */
async function deno(script: string, redirect = "") {
  const { code, stderr } = await new Deno.Command("bash", {
    args: ["-c", `"$0" eval "$1" ${redirect}`, Deno.execPath(), script],
    stderr: "piped",
  }).output();
  return { code, stderr: new TextDecoder().decode(stderr) };
}

Deno.test("Awaiting only a command's status leaves no file open.", async () => {
  const open = () => run("ls", `/proc/${Deno.pid}/fd`).lines.count();
  const before = await open();
  for (let i = 0; i < 200; i++) await run("true").status;
  assertLess(await open() - before, 10);
});

Deno.test("Output can still be read after awaiting the status.", async () => {
  const p = run("sh", "-c", "seq 1 3");
  assert((await p.status).success);
  assertEquals(await p.lines.collect(), ["1", "2", "3"]);
});

Deno.test("timeoutMs isn't held up by a program the child left holding stdout.", async () => {
  const start = Date.now();
  await assertRejects(
    () =>
      run({ timeoutMs: 200 }, "sh", "-c", "sleep 2; echo done").lines.collect(),
    TimeoutError,
  );
  assertLess(Date.now() - start, 1500);
});

Deno.test("writeTo a WritableStream aborts it when the source fails.", async () => {
  let aborted = false, closed = false;
  const stream = new WritableStream({
    abort() {
      aborted = true;
    },
    close() {
      closed = true;
    },
  });
  await assertRejects(() => enumerate(failing("a")).writeTo(stream));
  assert(aborted);
  assertFalse(closed);
});

Deno.test("writeTo a Writable throws the Writable's own errors.", async () => {
  const writable = (
    write: () => Promise<void>,
    close: () => Promise<void>,
  ): Writable<string> => ({ isClosed: false, write, close });
  const ok = () => Promise.resolve();
  const disk = () => Promise.reject(new Error("disk full"));
  await assertRejects(
    () => enumerate(["a"]).writeTo(writable(disk, ok)),
    Error,
    "disk full",
  );
  await assertRejects(
    () => enumerate(["a"]).writeTo(writable(ok, disk)),
    Error,
    "disk full",
  );
});

Deno.test("A failed write ends writeTo without waiting for the next item, and closes the source.", async () => {
  const closed = { value: false };
  async function* slow() {
    try {
      yield "a";
      await sleep(2000);
      yield "b";
    } finally {
      closed.value = true;
    }
  }
  const stream = new WritableStream({
    write() {
      throw new Error("sink failed");
    },
  });
  const start = Date.now();
  await assertRejects(
    () => enumerate(slow()).writeTo(stream),
    Error,
    "sink failed",
  );
  assertLess(Date.now() - start, 1000);
  await sleep(2100);
  assert(closed.value);
});

Deno.test("zip ends when one side ends, without waiting on the other.", async () => {
  async function* slow() {
    yield 0;
    await sleep(1500);
    yield 1;
  }
  const start = Date.now();
  assertEquals(await enumerate(["a"]).zip(slow()).collect(), [["a", 0]]);
  assertLess(Date.now() - start, 500);
});

Deno.test("Using a TransformStream again closes the source unread.", async () => {
  const stream = new TransformStream<Uint8Array, Uint8Array>();
  await run("echo", "a").transform(stream).collect();
  const yes = run("yes");
  await yes.transform(stream).collect().catch(() => {});
  // yes exits once its output is closed; left unread, it would never exit.
  assertEquals((await yes.status).success, false);
});

Deno.test("throw undefined upstream of a TransformStream still fails.", async () => {
  async function* source() {
    yield "a";
    throw undefined;
  }
  let threw = false;
  try {
    await enumerate(source()).transform(toBytes)
      .transform(new TransformStream()).collect();
  } catch {
    threw = true;
  }
  assert(threw);
});

Deno.test("take and drop round a fraction down and treat NaN as 0, as slice does.", async () => {
  const items = [0, 1, 2, 3, 4];
  assertEquals(await enumerate(items).take(1.5).collect(), items.slice(0, 1.5));
  assertEquals(await enumerate(items).drop(1.5).collect(), items.slice(1.5));
  assertEquals(await enumerate(items).drop(NaN).collect(), items.slice(NaN));
});

Deno.test("tee refuses a count that isn't a whole number of at least 1, and closes the source.", async () => {
  for (const n of [0, 2.5, NaN]) {
    const { state, items } = spy();
    assertThrows(() => enumerate(items).tee(n), RangeError);
    await sleep(20);
    assert(state.closed, `closed after tee(${n})`);
  }
});

Deno.test("buffer(NaN) passes chunks through, as 0 does.", async () => {
  const chunks = [new Uint8Array([1]), new Uint8Array([2])];
  assertEquals(
    (await enumerate(chunks).transform(buffer(NaN)).collect()).length,
    2,
  );
});

Deno.test("range refuses a NaN step, and one too small to move on.", () => {
  assertThrows(() => range({ to: 3, step: NaN }), RangeError);
  assertThrows(() => range({ from: 2 ** 53, to: 2 ** 53 + 4 }), RangeError);
});

Deno.test("enum numbers each pass over a source from 0.", async () => {
  const again = {
    async *[Symbol.asyncIterator]() {
      yield* ["a", "b"];
    },
  };
  const numbered = enumerate(again).enum();
  assertEquals(await numbered.collect(), [["a", 0], ["b", 1]]);
  assertEquals(await numbered.collect(), [["a", 0], ["b", 1]]);
});

Deno.test("Invalid UTF-8 in lines names the line, after the lines before it.", async () => {
  const bytes = new Uint8Array([
    ...encoder.encode("ok1\nok2\ncaf"),
    0xE9,
    ...encoder.encode(".txt\nok4\n"),
  ]);
  for (const size of [1, 2, 3, 100]) {
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < bytes.length; i += size) {
      chunks.push(bytes.slice(i, i + size));
    }
    const lines: string[] = [];
    await assertRejects(
      async () => {
        for await (const line of enumerate(chunks).lines) lines.push(line);
      },
      TypeError,
      "Invalid UTF-8 at line 3",
    );
    assertEquals(lines, ["ok1", "ok2"], `chunks of ${size}`);
  }
});

Deno.test("Invalid UTF-8 in JSON lines and records names the line or row.", async () => {
  await assertRejects(
    () =>
      enumerate([
        encoder.encode('{"a":1}\n{"a":2}\n'),
        new Uint8Array([0x22, 0xFF, 0x22, 0x0A]),
      ]).transform(fromJsonToRows()).collect(),
    TypeError,
    "Invalid UTF-8 in JSON data at line 3",
  );
  await assertRejects(
    () =>
      enumerate([new Uint8Array([0x61, 0x1F, 0x62, 0x1E, 0xFF, 0x1E])])
        .transform(fromRecordToRows()).collect(),
    TypeError,
    "Invalid UTF-8 in record data at row 2",
  );
});

Deno.test("A process error without a cause has no cause property.", async () => {
  const error = await assertRejects(() => run("false").lines.collect());
  assertFalse("cause" in (error as Error));
});

Deno.test("atomic writeTo replaces a read-only file, and keeps it read-only.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/ro.txt`;
    await Deno.writeTextFile(file, "old\n");
    await Deno.chmod(file, 0o444);
    await enumerate(["new"]).writeTo(file, { atomic: true });
    assertEquals(await Deno.readTextFile(file), "new\n");
    assertEquals((await Deno.stat(file)).mode! & 0o777, 0o444);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("atomic writeTo works for a name of 250 characters.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/${"n".repeat(250)}`;
    await enumerate(["x"]).writeTo(file, { atomic: true });
    assertEquals(await Deno.readTextFile(file), "x\n");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("atomic writeTo through /dev/stdout writes in place, not over the redirect's file.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const file = `${dir}/out.txt`;
    await Deno.writeTextFile(file, "");
    const inode = (await Deno.stat(file)).ino;
    const { code, stderr } = await deno(
      `import { enumerate } from "${MOD}";
       await enumerate(["new"]).writeTo("/dev/stdout", { atomic: true });`,
      `>> "${file}"`,
    );
    assertEquals(code, 0, stderr);
    assertEquals(await Deno.readTextFile(file), "new\n");
    assertEquals((await Deno.stat(file)).ino, inode);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("atomic writeTo cut short by Deno.exit leaves no new file behind.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const { code } = await deno(
      `import { range } from "${MOD}";
       setTimeout(() => Deno.exit(3), 300);
       await range({ to: Infinity })
         .map(async (n) => (await new Promise((r) => setTimeout(r, 1)), \`\${n}\`))
         .writeTo("${dir}/report.txt", { atomic: true });`,
    );
    assertEquals(code, 3);
    assertEquals(Array.from(Deno.readDirSync(dir)), []);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("A child that exited 130 a while ago doesn't slow main's exit.", async () => {
  const { code, stderr } = await deno(
    `import * as proc from "${MOD}";
     let returned = 0;
     globalThis.addEventListener("unload", () => console.error(Date.now() - returned));
     await proc.main(async () => {
       await proc.run("sh", "-c", "exit 130").lines.collect().catch(() => {});
       await new Promise((r) => setTimeout(r, 700));
       returned = Date.now();
     });`,
  );
  assertEquals(code, 0);
  assertLess(Number(stderr.trim()), 300);
});

Deno.test("After SIGTERM, main lets the program finish writing the children's last output.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const out = `${dir}/out.txt`;
    const child = new Deno.Command(Deno.execPath(), {
      args: [
        "eval",
        `import * as proc from "${MOD}";
         await proc.main(() =>
           proc.run("sh", "-c",
             "trap 'echo last words; exit 0' TERM; echo first; " +
             "while true; do sleep 0.05; done",
           ).lines.writeTo("${out}"));`,
      ],
      stderr: "null",
    }).spawn();
    await sleep(1000);
    child.kill("SIGTERM");
    assertEquals((await child.status).code, 143);
    assertEquals(await Deno.readTextFile(out), "first\nlast words\n");
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("An error that goes uncaught while main waits is reported, and the exit is 1.", async () => {
  const { code, stderr } = await deno(
    `import * as proc from "${MOD}";
     await proc.main(() => {
       proc.run("sh", "-c", "trap 'sleep 0.5; exit 0' TERM; sleep 5 >/dev/null 2>&1 & wait");
       setTimeout(() => { throw new Error("late failure"); }, 200);
       return 0;
     });`,
  );
  assertEquals(code, 1);
  assert(stderr.includes("late failure"), stderr);
});
