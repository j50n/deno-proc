import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { OutputHandler } from "../proc-group.ts";
import { readerToLines } from "../utility.ts";
import { MuxAsyncIterator } from "../../deps.ts";
import { ErrorHandler } from "../error-support.ts";
import { ChainedError } from "../chained-error.ts";

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
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
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
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
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

      const error = await input.handlerResult;
      if (error !== null) {
        throw new ChainedError(
          `${this.constructor.name}.process ${process.options.cmd.join(" ")}`,
          error,
        );
      }

      const status = await process.status();

      this.errorHandler(process.options, status, undefined);
    } finally {
      input.stdin.close();
      stdout.close();
      stderr.close();
      process.close();

      process.group.processes.delete(process.pid);
    }
  }
}
