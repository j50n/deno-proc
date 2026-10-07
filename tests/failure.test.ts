import { assert, assertEquals, assertFalse, assertRejects } from "@std/assert";
import { failureOf, settle } from "../src/failure.ts";
import {
  ExitCodeError,
  SignalError,
  TimeoutError,
  UpstreamError,
} from "../mod.ts";

// Which error a finished run fails with, case by case, without a child.

const cmd = ["grep", "--token=hunter2", "x"];
const exit = (code: number, signal: Deno.Signal | null = null) => ({
  success: code === 0 && signal == null,
  code,
  signal,
});
const upstream = new Error("upstream failed");

const cases: {
  name: string;
  status: Deno.CommandStatus;
  timedOut?: number;
  cause?: Error;
  expected?: { type: unknown; message: string };
}[] = [
  { name: "a clean exit", status: exit(0) },
  {
    name: "a non-zero exit",
    status: exit(3),
    expected: { type: ExitCodeError, message: "grep exited with code 3" },
  },
  {
    name: "a signal",
    status: exit(143, "SIGTERM"),
    expected: { type: SignalError, message: "grep was killed by SIGTERM" },
  },
  {
    name: "a timeout, whatever the exit",
    status: exit(0),
    timedOut: 100,
    expected: { type: TimeoutError, message: "grep timed out after 100 ms" },
  },
  {
    name: "a timeout over a signal",
    status: exit(143, "SIGTERM"),
    timedOut: 100,
    expected: { type: TimeoutError, message: "grep timed out after 100 ms" },
  },
  {
    name: "a clean exit whose input failed",
    status: exit(0),
    cause: upstream,
    expected: { type: UpstreamError, message: "upstream failed" },
  },
  {
    name: "a failed exit whose input failed too",
    status: exit(1),
    cause: upstream,
    expected: { type: ExitCodeError, message: "grep exited with code 1" },
  },
];

for (const c of cases) {
  Deno.test(`failureOf: ${c.name}.`, () => {
    const error = failureOf(cmd, c.status, c.timedOut, c.cause);
    if (c.expected === undefined) {
      assertEquals(error, undefined);
      return;
    }
    assert(error instanceof (c.expected.type as typeof Error));
    assertEquals(error.message, c.expected.message);
    assertEquals((error as ExitCodeError).command, cmd);
    if (c.cause) assertEquals(error.cause, c.cause);
    else assertFalse("cause" in error);
  });
}

Deno.test("settle throws the error when there is no fnError.", async () => {
  await assertRejects(() => settle(upstream, undefined, undefined), Error);
  await settle(undefined, undefined, undefined);
});

Deno.test("settle calls fnError only with an error or stderr data, and awaits it.", async () => {
  const calls: unknown[][] = [];
  const fnError = async (error?: Error, data?: string) => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    calls.push([error?.message, data]);
  };
  await settle<string | undefined>(
    undefined,
    fnError,
    Promise.resolve(undefined),
  );
  await settle(undefined, fnError, Promise.resolve("warnings"));
  await settle(upstream, fnError, undefined);
  // An fnStderr that failed counts as no data: its error is the error.
  await settle(upstream, fnError, Promise.reject(new Error("fnStderr")));
  assertEquals(calls, [
    [undefined, "warnings"],
    ["upstream failed", undefined],
    ["upstream failed", undefined],
  ]);
});
