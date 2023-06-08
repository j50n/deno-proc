import { Command, ProcessOptions } from "./command.ts";
import { parseArgs } from "./helpers.ts";
import { Uint8Enumerable } from "./enumerable.ts";

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
): Uint8Enumerable;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
 */
export function run(...cmd: Cmd): Uint8Enumerable;

export function run<S>(
  ...cmd: unknown[]
): Uint8Enumerable {
  const { options, command, args } = parseArgs<S>(cmd);

  const c = new Command(
    {
      ...options,
      stdout: "piped",
      stdin: "null",
      stderr: options.fnStderr == null ? "inherit" : "piped",
    },
    command,
    ...args,
  );

  const process = c.spawn();

  return new Uint8Enumerable(process.stdout);
}
