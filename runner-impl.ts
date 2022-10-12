import { Runner } from "./runner.ts";
import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
  Xyzzy,
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
  ): Xyzzy<B> {
    if (input === undefined && this.input.failOnEmptyInput) {
      throw new Error("empty input; process requires input");
    }
    return this.group.run(
      this.input,
      this.output,
      input as A,
      options,
    ) as Xyzzy<B>;
  }
}
