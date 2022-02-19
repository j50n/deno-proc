import { RunnerImpl } from "./runner-impl.ts";
import { bytesInput, bytesOutput } from "./runners/handlers/bytes.ts";
import { emptyInput, emptyOutput } from "./runners/handlers/empty.ts";
import { stringInput, stringOutput } from "./runners/handlers/string.ts";
import { stringArrayOutput } from "./runners/handlers/string-array.ts";
import {
  Group,
  group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";

const globalGroup = group();

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
): (group?: Group) => Runner<A, B> {
  return (group?: Group) => new RunnerImpl(group || globalGroup, input, output);
}

/**
 * A simple runner.
 * - `stdin` is empty.
 * - `stdout` and `stderr` are redirected to the parent.
 * - the global group is used.
 */
export async function run00(options: RunOptions): Promise<void> {
  await new RunnerImpl(globalGroup, emptyInput(), emptyOutput()).run(
    options,
  );
}

/**
 * A non-streaming runner for `string[]` output.
 * - `stdout` is interpreted as lines of text and returned as a `string[]`.
 * - `stdin` is empty.
 * - `stderr` is redirected to the parent.
 * - the global group is used.
 */
export async function run0Sa(options: RunOptions): Promise<string[]> {
  return await new RunnerImpl(globalGroup, emptyInput(), stringArrayOutput())
    .run(
      options,
    );
}

/**
 * A non-streaming runner for `Uint8Array` input and `string` output.
 * - `stdout` is interpreted as a `string`.
 * - `stdin` is interpreted as a `Uint8Array`.
 * - `stderr` is redirected to the parent.
 * - the global group is used.
 */
export async function runBS(
  options: RunOptions,
  input: Uint8Array,
): Promise<string> {
  return await new RunnerImpl(globalGroup, bytesInput(), stringOutput())
    .run(
      options,
      input,
    );
}

/**
 * A non-streaming runner for `string`input and `Uint8Array` output.
 * - `stdout` is interpreted as a `Uint8Array`.
 * - `stdin` is interpreted as a `string`.
 * - `stderr` is redirected to the parent.
 * - the global group is used.
 */
export async function runSB(
  options: RunOptions,
  input: string,
): Promise<Uint8Array> {
  return await new RunnerImpl(globalGroup, stringInput(), bytesOutput())
    .run(
      options,
      input,
    );
}
