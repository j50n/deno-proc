import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { type ErrorHandler } from "../error-support.ts";
import { type OutputHandler } from "../proc-group.ts";
import { type StderrProcessor } from "../stderr-support.ts";
import { readerToBytes, readerToLines } from "../utility.ts";

/**
 * Abstract class for handling text output.
 */
abstract class AbstractOutputHandler<B, C> implements OutputHandler<B> {
  constructor(
    public readonly processStderr: StderrProcessor,
    public readonly errorHandler: ErrorHandler,
  ) {
  }

  abstract processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ): B | Promise<B>;

  protected async handleStderr(
    stderr: MultiCloseReader,
  ): Promise<string[] | unknown> {
    let stderrLines: string[] | unknown;

    try {
      stderrLines = await this.processStderr(readerToLines(stderr));
    } catch (e) {
      if (e instanceof Deno.errors.Interrupted) {
        // Ignore.
      } else {
        throw e;
      }
    } finally {
      stderr.close();
    }

    return stderrLines;
  }

  protected abstract transformReader(
    reader: MultiCloseReader,
  ): AsyncIterableIterator<C>;

  protected async *process(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ): AsyncIterableIterator<C> {
    try {
      const se = this.handleStderr(stderr);

      yield* this.transformReader(stdout);

      await input.handlerResult;
      const stderrLines: string[] | unknown = await se;
      const status = await process.status();

      this.errorHandler(process.options, status, stderrLines);
    } finally {
      input.stdin.close();
      stdout.close();
      stderr.close();
      process.close();

      process.group.processes.delete(process.pid);
    }
  }
}

export abstract class AbstractTextOutputHandler<B>
  extends AbstractOutputHandler<B, string> {
  protected async *transformReader(
    reader: MultiCloseReader,
  ): AsyncIterableIterator<string> {
    yield* readerToLines(reader);
  }
}

export abstract class AbstractBytesOutputHandler<B>
  extends AbstractOutputHandler<B, Uint8Array> {
  protected async *transformReader(
    reader: MultiCloseReader,
  ): AsyncIterableIterator<Uint8Array> {
    yield* readerToBytes(reader);
  }
}
