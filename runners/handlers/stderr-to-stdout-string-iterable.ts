import { MultiCloseProcess, MultiCloseReader } from "../closers.ts";
import { OutputHandler } from "../proc-group.ts";
import { readerToLines } from "../utility.ts";
import { MuxAsyncIterator } from "../../deps.ts";
import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";

/**
 * Redirect `stderr` into `stdout` so that you get both, as lines, for output.
 *
 * The order of the lines is not guaranteed. The timing of the lines is not guaranteed.
 *
 * @param errorHandler Error handler.
 * @returns `stdout` and `stderr` lines as an `AsyncIterable`.
 */
export function stderrToStdoutStringIterableOutput(
  errorHandler: ErrorHandler = defaultErrorHandling,
) {
  return new StderrToStdoutStringIterableOutputHandler(errorHandler);
}

/**
 * Redirect `stderr` into `stdout`.
 */
export class StderrToStdoutStringIterableOutputHandler
  implements OutputHandler<AsyncIterable<string>> {
  constructor(
    public readonly errorHandler: ErrorHandler,
  ) {}

  processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterable<string> {
    return this.process(stdout, stderr, process, input);
  }

  protected async *handleStderr(
    stderr: MultiCloseReader,
  ): AsyncIterableIterator<string> {
    try {
      yield* readerToLines(stderr);
    } catch (e) {
      if (e instanceof Deno.errors.Interrupted) {
        // Ignore.
      } else {
        throw e;
      }
    } finally {
      stderr.close();
    }
  }

  protected async *process(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterableIterator<string> {
    try {
      const mux = new MuxAsyncIterator<string>();
      mux.add(this.handleStderr(stderr));
      mux.add(readerToLines(stdout));

      try {
        yield* mux;
      } finally {
        stderr.close();
        stdout.close();
      }

      await input;
      const status = await process.status();

      this.errorHandler(process.options, status, undefined);
    } finally {
      process.close();
      process.group.processes.delete(process.pid);
    }
  }
}
