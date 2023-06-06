import { Command, ProcessOptions } from "./command.ts";
import { parseArgs } from "./helpers.ts";
import { Enumerable } from "./enumerable.ts";

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
): Enumerable<Uint8Array>;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
 */
export function run(...cmd: Cmd): Enumerable<Uint8Array>;

export function run<S>(
  ...cmd: unknown[]
): Enumerable<Uint8Array> {
  const { options, command, args } = parseArgs<S>(cmd);

  const c = new Command(
    {
      ...options,
      stdout: "piped",
      stderr: options.fnStderr == null ? "inherit" : "piped",
    },
    command,
    ...args,
  );

  return new Enumerable(c.spawn().stdout);
}
