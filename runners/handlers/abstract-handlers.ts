import { optionalChain } from "../chained-error.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { type ErrorHandler } from "../error-support.ts";
import { type OutputHandler } from "../proc-group.ts";
import { type StderrProcessor } from "../stderr-support.ts";
import {
  bytesToTextLines,
  readerToBytes,
  readerToBytesUnbuffered,
} from "../utility.ts";

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
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): B | Promise<B>;

  protected async handleStderr(
    stderr: MultiCloseReader,
  ): Promise<string[] | unknown> {
    let stderrLines: string[] | unknown;

    try {
      stderrLines = await this.processStderr(
        readerToBytesUnbuffered(stderr),
      );
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
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): AsyncIterableIterator<C> {
    try {
      const se = this.handleStderr(stderr);

      console.error("BEFORE")
      for await (const thing of this.transformReader(stdout)) {
        yield thing;
      }
      console.error("AFTER")

      const error = await input.handlerResult;
      if (error !== null) {
        throw optionalChain(
          `${this.constructor.name}.process  ${process.options.cmd.join(" ")}`,
          error,
        );
      }

      const details: unknown = await se;
      const status = await process.status();

      console.error("STATUS " + status.code);

      this.errorHandler(process.options, status, details);
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
    yield* bytesToTextLines(readerToBytes(reader));
  }
}

export abstract class AbstractTextUnbufferedOutputHandler<B>
  extends AbstractOutputHandler<B, string> {
  protected async *transformReader(
    reader: MultiCloseReader,
  ): AsyncIterableIterator<string> {
    yield* bytesToTextLines(readerToBytesUnbuffered(reader));
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

export abstract class AbstractBytesUnbufferedOutputHandler<B>
  extends AbstractOutputHandler<B, Uint8Array> {
  protected async *transformReader(
    reader: MultiCloseReader,
  ): AsyncIterableIterator<Uint8Array> {
    yield* readerToBytesUnbuffered(reader);
  }
}
