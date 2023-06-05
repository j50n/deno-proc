import { Command, ProcessOptions } from "./command.ts";
import { parseArgs } from "./helpers.ts";
import { Runnable } from "./runnable-iterable.ts";

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
): Runnable<Uint8Array>;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
 */
export function run(...cmd: Cmd): Runnable<Uint8Array>;

export function run<S>(
  ...cmd: unknown[]
): Runnable<Uint8Array> {
  const { options, command, args } = parseArgs<S>(cmd);

  const c = new Command(
    { ...options, stdout: "piped" },
    command,
    ...args,
  );

  return new Runnable(c.spawn().stdout);
}
