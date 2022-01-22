import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { InputHandler } from "../process-group.ts";
import { AbstractTextOutputHandler } from "./abstract-text-output-handler.ts";

/**
 * Source `stdin` from an iterable of lines.
 */
export class StringIterableInput
  implements InputHandler<AsyncIterable<string>> {
  async processInput(
    input: AsyncIterable<string>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const cr = encoder.encode("\n");

      const bw = new BufWriter(stdin, 16384);
      for await (const line of input) {
        await bw.write(encoder.encode(line));
        await bw.write(cr);
        await bw.flush();
      }
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as an iterable over the lines.
 */
export class StringIterableOutput
  extends AbstractTextOutputHandler<AsyncIterable<string>> {
  constructor(
    processStderr: (
      lines: AsyncIterable<string>,
    ) => Promise<unknown | string[]>,
  ) {
    super(processStderr);
  }

  processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): AsyncIterable<string> {
    return this.process(stdout, stderr, process, input);
  }
}
