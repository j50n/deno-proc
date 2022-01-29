import { PromiseOrIterable, Runner } from "./runner.ts";
import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";

export class RunnerImpl<A, B> implements Runner<A, B> {
  constructor(
    public readonly group: Group,
    public readonly input: InputHandler<A>,
    public readonly output: OutputHandler<B>,
  ) {
  }

  run(
    options: RunOptions,
    input?: A,
  ): PromiseOrIterable<B> {
    if (input === undefined && this.input.failOnEmptyInput) {
      throw new Error("empty input; process requires input");
    }
    return this.group.run(
      this.input,
      this.output,
      input as A,
      options,
    ) as PromiseOrIterable<B>;
  }
}
