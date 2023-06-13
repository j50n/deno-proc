import { Process, ProcessOptions } from "./process.ts";
import { parseArgs } from "./helpers.ts";
import { ProcessEnumerable } from "./enumerable.ts";

/** The type signature for a command. */
export type Cmd = [string | URL, ...string[]];

/**
 * Run a process.
 * @param cmd The command.
 * @param options Options.
 * @returns A child process instance.
 */
export function run<S>(
  options: ProcessOptions<S>,
  ...cmd: Cmd
): ProcessEnumerable<S>;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
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
