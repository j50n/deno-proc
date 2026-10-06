import { Process, type ProcessOptions } from "./process.ts";
import { parseArgs } from "./helpers.ts";
import { ProcessEnumerable } from "./enumerable.ts";

/**
 * A command and its arguments: the program (a name looked up on `PATH`, a
 * path, or a file URL), then each argument as a string. No shell is involved,
 * so arguments need no quoting.
 *
 * @example
 * ```typescript
 * import { type Cmd, run } from "@j50n/proc";
 *
 * const cmd: Cmd = ["ls", "-la"];
 * await run(...cmd).lines.forEach(console.log);
 * ```
 */
export type Cmd = [string | URL, ...string[]];

/**
 * Start a child process and return its output to iterate: the entry point of
 * proc.
 *
 * `run("ls", "-la")` spawns the child at the call and returns a
 * {@link ProcessEnumerable}, an async iterable of the child's stdout as bytes
 * that has the Enumerable methods. Read it as text with `.lines`, pipe it into
 * another command with `.run(...)`, and consume it with `.collect()`,
 * `.forEach()`, `.first`, `for await`, and the rest. The methods are lazy; the
 * process is not.
 *
 * Options go first: `run({ cwd, env, fnStderr, fnError, buffer }, ...cmd)`
 * (see {@link ProcessOptions}). The child's stdin is closed (`"null"`), and its
 * stderr goes to yours unless you pass `fnStderr`. A program that doesn't exist
 * throws `Deno.errors.NotFound` from `run()` itself.
 *
 * **Read stdout.** The child writes into a pipe that holds about 64 KB, and
 * once it is full the child blocks until something reads. If nothing reads a
 * child with more output than that, it never exits, so awaiting `.status`
 * hangs and so does your program. Stopping early (`.take(2)`, `break`) is fine
 * and throws nothing; the consumer returns once the child exits, which for
 * most programs is the next time they write and die of SIGPIPE.
 *
 * **Errors** are thrown where you consume the output, after every line has
 * been delivered. A non-zero exit throws {@link ExitCodeError} (`.code`), and
 * death by a signal throws {@link SignalError} (`.signal`). In a pipeline, a
 * process that fails upstream reaches the end as an {@link UpstreamError}, or
 * as the last process's own `ExitCodeError` if it failed too, with the
 * upstream error as `cause`. An error from your own callback arrives as is, or
 * as that `cause` if a `.run()` follows it. So one `try`/`catch` around the
 * awaited consumer catches everything. To capture stderr, or to change what
 * is thrown, use `fnStderr` and `fnError`.
 *
 * In a program whose children must be stopped when it exits, as in a
 * container, wrap the program in {@link main}.
 *
 * @example Read lines, and pipe one command into another
 * ```typescript
 * import { run } from "@j50n/proc";
 *
 * const files = await run({ cwd: "/tmp" }, "ls", "-1").lines.collect();
 *
 * const lower = await run("echo", "HELLO").run("tr", "A-Z", "a-z").lines.first;
 * // "hello"
 * ```
 *
 * @example Handle a failed command
 * ```typescript
 * import { ExitCodeError, run } from "@j50n/proc";
 *
 * try {
 *   await run("sh", "-c", "echo partial; exit 3").lines.forEach(console.log);
 * } catch (error) {
 *   if (error instanceof ExitCodeError) {
 *     console.error(`${error.command.join(" ")} exited with ${error.code}`);
 *   } else {
 *     throw error;
 *   }
 * }
 * ```
 *
 * @param options How to run the child; see {@link ProcessOptions}.
 * @param cmd The program and its arguments.
 * @returns The child's stdout, to iterate or call methods on.
 */
export function run<S>(
  options: ProcessOptions<S>,
  ...cmd: Cmd
): ProcessEnumerable<S>;

/**
 * Start a child process and return its output to iterate.
 *
 * The child starts at the call. Read its stdout (`.lines.collect()`,
 * `.forEach()`, ...), or a child with more than about 64 KB of output blocks
 * and your program hangs. A non-zero exit throws {@link ExitCodeError} after
 * the last line. Pass options first to set `cwd`, `env`, or stderr handling;
 * the overload that takes options has the details.
 *
 * @param cmd The program and its arguments.
 * @returns The child's stdout, to iterate or call methods on.
 */
export function run(...cmd: Cmd): ProcessEnumerable<unknown>;

export function run<S>(
  ...cmd: unknown[]
): ProcessEnumerable<S> {
  const { options, command, args } = parseArgs<S>(cmd);

  const process = new Process(
    {
      ...options,
      stdout: "piped",
      stdin: "null",
      stderr: options.fnStderr == null ? "inherit" : "piped",
    },
    command,
    args,
  );

  return new ProcessEnumerable(process);
}
