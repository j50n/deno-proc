import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { OutputHandler } from "../proc-group.ts";
import { readerToBytesUnbuffered, toLines } from "../utility.ts";
import { MuxAsyncIterator } from "../../deps.ts";
import { ErrorHandler } from "../error-support.ts";
import { optionalChain } from "../chained-error.ts";

/**
 * Redirect `stderr` into `stdout`. This handler is always unbuffered so that
 * the lines come out as close to real-time as possible.
 */
export class StderrToStdoutStringAsyncIterableOutputHandler
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
      yield* toLines(readerToBytesUnbuffered(stderr));
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
      mux.add(toLines(readerToBytesUnbuffered(stdout)));

      try {
        yield* mux;
      } finally {
        stderr.close();
        stdout.close();
      }

      const error = await input.handlerResult;
      if (error !== null) {
        throw optionalChain(
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
