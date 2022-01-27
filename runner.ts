import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";

/**
 * Define a reusable process runner.
 * @param input Handler for the input to the process.
 * @param output Handler for the output from the process.
 * @returns A process runner.
 */
export function runner<A, B>(
  input: InputHandler<A>,
  output: OutputHandler<B>,
): Runner<A, B> {
  return new Runner(input, output);
}

type PromiseOrIterable<B> = B extends AsyncIterable<unknown> ? B : Promise<B>;

export class Runner<A, B> {
  constructor(
    public readonly input: InputHandler<A>,
    public readonly output: OutputHandler<B>,
  ) {
  }

  run(
    group: Group,
    options: RunOptions,
    input?: A,
  ): PromiseOrIterable<B> {
    if (input === undefined && this.input.failOnEmptyInput) {
      throw new Error("empty input; process requires input");
    }
    return group.run(
      this.input,
      this.output,
      input as A,
      options,
    ) as PromiseOrIterable<B>;
  }
}
