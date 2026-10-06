import { assert, assertEquals, assertLess, assertRejects } from "@std/assert";
import {
  enumerate,
  ExitCodeError,
  main,
  range,
  run,
  terminateAll,
  UpstreamError,
  WritableIterable,
} from "../../mod.ts";

// Found in the second pre-0.26.0 review.

/** An endless source that records how far it got and whether it was closed. */
function spy() {
  const state = { pulled: 0, closed: false };
  async function* items() {
    try {
      while (true) {
        state.pulled += 1;
        yield state.pulled;
      }
    } finally {
      state.closed = true;
    }
  }
  return { state, items: items() };
}

/** Let background closes run. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

Deno.test("writeTo(path) that can't open the file closes the source.", async () => {
  const dir = await Deno.makeTempDir();
  try {
    const yes = run("yes");
    await assertRejects(
      () => yes.lines.writeTo(`${dir}/missing/out.txt`),
      Deno.errors.NotFound,
    );
    // yes exits once its output is closed; left unread, it would never exit.
    assertEquals((await yes.status).success, false);
  } finally {
    await Deno.remove(dir, { recursive: true });
  }
});

Deno.test("writeTo a locked stream closes the source.", async () => {
  const { state, items } = spy();
  const stream = new WritableStream();
  stream.getWriter();
  await assertRejects(() => enumerate(items).writeTo(stream), TypeError);
  await settle();
  assert(state.closed);
});

for (const method of ["concurrentMap", "concurrentUnorderedMap"] as const) {
  Deno.test(`${method} with a bad concurrency closes the source.`, async () => {
    const { state, items } = spy();
    await assertRejects(() =>
      enumerate(items)[method]((n) => Promise.resolve(n), { concurrency: 0 })
        .collect()
    );
    await settle();
    assert(state.closed);
  });
}

Deno.test("concat stopped early neither waits for nor checks the second source.", async () => {
  assertEquals(
    await enumerate(["a"]).concat(run("sh", "-c", "exit 3").lines).take(1)
      .collect(),
    ["a"],
  );
  const never = (async function* () {
    await new Promise(() => {});
    yield "x";
  })();
  assertEquals(await enumerate(["a"]).concat(never).first, "a");
});

Deno.test("zip stopped early reads no more from either side.", async () => {
  const a = spy(), b = spy();
  await enumerate(a.items).zip(b.items).take(2).collect();
  assertEquals([a.state.pulled, b.state.pulled], [2, 2]);
  assert(a.state.closed && b.state.closed);

  const stalls = (async function* () {
    yield 1;
    yield 2;
    await new Promise(() => {});
  })();
  assertEquals(await range({ to: Infinity }).zip(stalls).take(2).count(), 2);
});

Deno.test("concurrentUnorderedMap costs the same per item at any concurrency.", async () => {
  const then = Promise.prototype.then;
  let calls = 0;
  // deno-lint-ignore no-explicit-any
  (Promise.prototype as any).then = function (
    this: Promise<unknown>,
    ...args: Parameters<typeof then>
  ) {
    calls += 1;
    return then.apply(this, args);
  };
  try {
    await range({ to: 2000 })
      .concurrentUnorderedMap(
        (n) => new Promise((resolve) => setTimeout(() => resolve(n), 1)),
        { concurrency: 1000 },
      )
      .count();
  } finally {
    Promise.prototype.then = then;
  }
  assertLess(calls / 2000, 50); // about 1500 when it raced every call
});

Deno.test("writeTo a WritableIterable stops once its reader stops.", async () => {
  const items = new WritableIterable<number>();
  let produced = 0;
  const writing = range({ to: Infinity }).map((n) => (produced++, n))
    .writeTo(items);
  for await (const _ of items) break;
  await writing;
  assertLess(produced, 10);
  assert(items.isClosed);
});

Deno.test("take(0) reads nothing and closes the source; take(NaN) takes none.", async () => {
  const { state, items } = spy();
  assertEquals(await enumerate(items).take(0).collect(), []);
  await settle();
  assert(state.closed);
  assertEquals(await enumerate([1, 2]).take(NaN).collect(), []);
});

Deno.test("writeBytesTo reports the source's error, not a failing close's.", async () => {
  const writer = {
    write: (bytes: Uint8Array) => Promise.resolve(bytes.length),
    close() {
      throw new Error("close failed");
    },
  };
  async function* source() {
    yield new Uint8Array(1);
    throw new Error("source failed");
  }
  await assertRejects(
    () => enumerate(source()).writeBytesTo(writer),
    Error,
    "source failed",
  );
});

Deno.test("A printed process error doesn't show the arguments.", async () => {
  const error = await assertRejects(
    () =>
      run("sh", "-c", "exit 3", "x", "--token=hunter2").run("cat").lines
        .collect(),
    UpstreamError,
  );
  assert(!Deno.inspect(error, { depth: 10 }).includes("hunter2"));
  assert(!JSON.stringify(error).includes("hunter2"));
  const cause = error.cause as ExitCodeError;
  assertEquals(cause.command.at(-1), "--token=hunter2");
  // One mention of the failure per error, not one per copy of the cause.
  assertEquals(
    Deno.inspect(error, { depth: 10 }).split("exited with code 3").length - 1,
    2,
  );
});

Deno.test("An fnStderr that throws at once fails the output instead of hanging.", async () => {
  await assertRejects(
    () =>
      enumerate(["a"]).run({
        fnStderr: () => {
          throw new Error("at once");
        },
      }, "cat").lines.collect(),
    Error,
    "at once",
  );
});

Deno.test("A NaN timeout is refused, not taken as forever.", async () => {
  await assertRejects(() => terminateAll({ timeoutMs: NaN }), RangeError);
  await assertRejects(() => main(() => 0, { timeoutMs: NaN }), RangeError);
});
