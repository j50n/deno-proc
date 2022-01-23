import {
  InputHandler,
  OutputHandler,
  ProcGroup,
  RunOptions,
} from "./runners/proc-group.ts";

export function proc<A, B>(
  input: InputHandler<A>,
  output: OutputHandler<B>,
): Proc<A, B> {
  return new Proc(input, output);
}

export class Proc<A, B> {
  constructor(
    public readonly input: InputHandler<A>,
    public readonly output: OutputHandler<B>,
  ) {
  }

  run(
    group: ProcGroup,
    options: RunOptions,
    input?: A,
  ): B extends AsyncIterable<unknown> ? B : Promise<B> {
    if (input === undefined && this.input.failOnEmptyInput) {
      throw new Error("empty input; process requires input");
    }
    return group.run(this.input, this.output, input as A, options) as B extends
      AsyncIterable<unknown> ? B : Promise<B>;
  }
}
