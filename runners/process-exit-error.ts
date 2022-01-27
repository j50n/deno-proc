import { RunOptions } from "./proc-group.ts";

export class ProcessExitError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly options: RunOptions,
    public readonly signal?: number,
    public readonly details?: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}
