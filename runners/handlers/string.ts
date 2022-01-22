import {
  ClosableStringReader,
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { InputHandler, OutputHandler } from "../process-group.ts";
import { pump, reader2Lines } from "../utility.ts";

/**
 * Source `stdin` from a `string`. `stdin` is closed once the text data is written.
 */
export class StringInput implements InputHandler<string> {
  async processInput(input: string, stdin: MultiCloseWriter): Promise<void> {
    try {
      await pump(new ClosableStringReader(input), stdin);
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as a `string`.
 */
export class StringOutput implements OutputHandler<string> {
  constructor(
    public processStderr: (
      lines: AsyncIterableIterator<string>,
    ) => Promise<unknown | string[]>,
  ) {
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): Promise<string> {
    const lines = [];
    for await (const line of this.process(stdout, stderr, process, input)) {
      lines.push(line);
    }
    return lines.join("\n");
  }

  protected async handleStderr(
    stderr: MultiCloseReader,
  ): Promise<string[] | unknown> {
    let stderrLines: string[] | unknown;

    try {
      stderrLines = await this.processStderr(reader2Lines(stderr));
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

      for await (const line of reader2Lines(stdout)) {
        yield line;
      }

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
