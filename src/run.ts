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
 * this function returns an `AsyncIterable` that makes it trivial to:
 * - Chain processes together with `.run()`
 * - Transform output with `.map()`, `.filter()`, etc.
 * - Parse lines with `.lines`
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
 * @example Basic command execution
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * // Get output as lines
 * const result = await run("echo", "hello").lines.collect();
 * // ["hello"]
 * ```
 *
 * @example Pipe commands together
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * // Chain processes like shell pipes
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
 * // Map over lines
 * const numbers = await run("echo", "-e", "1\\n2\\n3")
 *   .lines
 *   .map(line => parseInt(line))
 *   .collect();
 * // [1, 2, 3]
 * ```
 *
 * @example Count lines
 * ```typescript
 * import { run } from "jsr:@j50n/proc";
 *
 * const count = await run("echo", "-e", "a\\nb\\nc").lines.count();
 * // 3
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
