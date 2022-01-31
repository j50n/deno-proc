import { RunOptions } from "./proc-group.ts";

/**
 * The standard error that is thrown when a process exits with a non-0 exit code.
 */
export class ProcessExitError extends Error {
  /** Constructor. */
  constructor(
    /** Error message. */
    message: string,
    /** Exit code. */
    public readonly code: number,
    /** Run options for the command. */
    public readonly options: RunOptions,
    /** Signal, if the exit was due to a signal. */
    public readonly signal?: number,
    /** Details (optionally scraped from `stderr`). */
    public readonly details?: string[],
  ) {
    super(`${message} ${JSON.stringify(options.cmd)}`);
    this.name = this.constructor.name;
  }
}
