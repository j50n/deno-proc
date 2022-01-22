import {
  ClosableStringReader,
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { InputHandler } from "../process-group.ts";
import { pump } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-text-output-handler.ts";

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
export class StringOutput extends AbstractTextOutputHandler<string> {
  constructor(
    processStderr: (
      lines: AsyncIterableIterator<string>,
    ) => Promise<unknown | string[]>,
  ) {
    super(processStderr);
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
}
