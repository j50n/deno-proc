import { MultiCloseProcess, MultiCloseReader } from "../closers.ts";
import { OutputHandler } from "../proc-group.ts";
import { ProcessExitError } from "../process-exit-error.ts";
import { readerToBytes, readerToLines } from "../utility.ts";

/**
 * Abstract class for handling text output.
 */
abstract class AbstractOutputHandler<B, C> implements OutputHandler<B> {
  constructor(
    public processStderr: (
      lines: AsyncIterableIterator<string>,
    ) => Promise<unknown | string[]>,
  ) {
  }

  abstract processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
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
    input: Promise<void>,
  ): AsyncIterableIterator<C> {
    try {
      const se = this.handleStderr(stderr);

      yield* this.transformReader(stdout);

      await input;
      const stderrLines: string[] | unknown = await se;

      const status = await process.status();

      //TODO: This won't work for all cases, if error code isn't standard.
      if (!status.success) {
        let details: string | undefined = undefined;
        if (Array.isArray(stderrLines)) {
          details = stderrLines.map((line) => `\t${line}`).join("\n");
        }

        throw new ProcessExitError(
          `process exited with code: ${status.code}`,
          status.code,
          status.signal,
          details,
        );
      }
    } finally {
      stdout.close();
      process.close();
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
