import { Process, type ProcessOptions } from "./process.ts";
import { parseArgs } from "./helpers.ts";
import { ProcessEnumerable } from "./enumerable.ts";

/**
 * Command signature: program name/path followed by arguments.
 *
 * @example
 * ```typescript
 * ["ls", "-la"]
 * ["echo", "hello"]
 * ```
 */
export type Cmd = [string | URL, ...string[]];

/**
 * Run a child process with a fluent, composable API.
 *
 * This is the primary entry point for deno-proc. Unlike Deno's built-in `Deno.Command`,
 * this function returns a `ProcessEnumerable` (extends `AsyncIterable`) that makes it trivial to:
 * - Chain processes together with `.run()`
 * - Transform output with `.map()`, `.filter()`, etc.
 * - Parse lines with `.lines` property
 * - Handle errors gracefully
 * - Avoid common pitfalls like deadlocks and resource leaks
 *
 * **Why use this instead of `Deno.Command`?**
 *
 * Deno's `Deno.Command` requires manual stream handling, careful resource management,
 * and verbose boilerplate. With deno-proc:
 * - No manual stream reading/writing
 * - Automatic resource cleanup
 * - Composable operations via AsyncIterable
 * - Built-in line parsing and transformations
 * - Proper error propagation
 *
 * **Important: Error Handling**
 *
 * Processes that exit with non-zero codes throw `ExitCodeError` when you consume their output.
 * You must consume stdout (via `.lines`, `.collect()`, etc.) or the process will leak resources.
 *
 * **Important: Resource Management**
 *
 * Always consume the process output or explicitly handle the stream. Unconsumed stdout will
 * cause resource leaks. Use `.lines.collect()`, `.lines.forEach()`, or similar to consume output.
 *
 * @example Basic command execution
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * // Get output as lines - .lines is a property, .collect() is a method
 * const result = await run("echo", "hello").lines.collect();
 * // ["hello"]
 * ```
 *
 * @example Pipe commands together
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * // Chain processes with .run() - .lines is a property, .first is a property
 * const result = await run("echo", "HELLO")
 *   .run("tr", "A-Z", "a-z")
 *   .lines
 *   .first;
 * // "hello"
 * ```
 *
 * @example Process and transform output
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * // Map over lines and collect results
 * const numbers = await run("echo", "-e", "1\\n2\\n3")
 *   .lines
 *   .map(line => parseInt(line))
 *   .collect();
 * // [1, 2, 3]
 * ```
 *
 * @example Handle errors from failed processes
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * try {
 *   await run("false").lines.collect();
 * } catch (error) {
 *   if (error.code) {
 *     console.error(`Process failed with exit code ${error.code}`);
 *   }
 * }
 * ```
 *
 * @example Check exit status without throwing
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * const p = run("some-command");
 * await p.lines.collect(); // Consume output
 * const status = await p.status; // .status is a property returning Promise<CommandStatus>
 * if (status.code !== 0) {
 *   console.error(`Failed with code ${status.code}`);
 * }
 * ```
 *
 * @param options Process options (optional).
 * @param cmd The command and arguments.
 * @returns A ProcessEnumerable for chaining operations.
 */
export function run<S>(
  options: ProcessOptions<S>,
  ...cmd: Cmd
): ProcessEnumerable<S>;

/**
 * Run a child process with a fluent, composable API.
 *
 * @param cmd The command and arguments.
 * @returns A ProcessEnumerable for chaining operations.
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
