import { RunnerImpl } from "./runner-impl.ts";
import { emptyInput, emptyOutput } from "./runners/handlers/empty.ts";
import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";

/** Something that is either a promise or an iterable. */
export type PromiseOrIterable<B> = B extends AsyncIterable<unknown> ? B
  : Promise<B>;

export interface Runner<A, B> {
  /**
   * Run a command.
   * @param options Run options.
   * @param input Input data.
   */
  run(
    options: RunOptions,
    input?: A,
  ): PromiseOrIterable<B>;
}

/**
 * Define a reusable process runner.
 * @param input Handler for the input to the process.
 * @param output Handler for the output from the process.
 * @returns A process runner.
 */
export function runner<A, B>(
  input: InputHandler<A>,
  output: OutputHandler<B>,
): (group: Group) => Runner<A, B> {
  return (group: Group) => new RunnerImpl(group, input, output);
}

/**
 * A simple runner. `stdin` is empty. `stdout` and `stderr` are directed to the parent.
 * Note that `stdout` is treated is assumed to be text and not byte data.
 * @returns A process runner.
 */
export function simpleRunner(group: Group): Runner<void, void> {
  return new RunnerImpl(group, emptyInput(), emptyOutput());
}
