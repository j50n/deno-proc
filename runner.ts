import { RunnerImpl } from "./runner-impl.ts";
import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";

export type PromiseOrIterable<B> = B extends AsyncIterable<unknown> ? B
  : Promise<B>;

export interface Runner<A, B> {
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
