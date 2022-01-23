import { MultiCloseProcess, MultiCloseReader } from "../closers.ts";
import { OutputHandler } from "../process-group.ts";
import { readerToLines } from "../utility.ts";

/**
 * Abstract class for handling text output.
 */
export abstract class AbstractTextOutputHandler<B> implements OutputHandler<B> {
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

  protected async *process(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterableIterator<string> {
    try {
      const se = this.handleStderr(stderr);

      yield* readerToLines(stdout);

      await input;
      const stderrLines: string[] | unknown = await se;

      const status = await process.status();

      //TODO: This won't work for all cases, if error code isn't standard.
      if (!status.success) {
        //TODO: Specialize error; add signal
        let errMessage = [`process exited with code: ${status.code}`];
        if (Array.isArray(stderrLines)) {
          errMessage = errMessage.concat(
            stderrLines.map((line) => `\t${line}`),
          );
        }
        throw new Error(errMessage.join("\n"));
      }
    } finally {
      stdout.close();
      process.close();
    }
  }
}
