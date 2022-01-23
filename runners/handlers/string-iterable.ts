import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { InputHandler, OutputHandler } from "../process-group.ts";
import { stderrLinesToConsoleError } from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-handlers.ts";

export function StringIterableInput(
  autoflush = true,
): InputHandler<AsyncIterable<string>> {
  return new StringIterableInputHandler(autoflush);
}

export function StringIterableOutput(
  processStderr: (
    lines: AsyncIterable<string>,
  ) => Promise<unknown | string[]> = stderrLinesToConsoleError,
): OutputHandler<AsyncIterable<string>> {
  return new StringIterableOutputHandler(processStderr);
}

/**
 * Source `stdin` from an iterable of lines.
 */
export class StringIterableInputHandler
  implements InputHandler<AsyncIterable<string>> {
  constructor(public readonly autoflush: boolean) {
  }

  async processInput(
    input: AsyncIterable<string>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const cr = encoder.encode("\n");

      const bw = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
      for await (const line of input) {
        await bw.write(encoder.encode(line));
        await bw.write(cr);
        if (this.autoflush) {
          await bw.flush();
        }
      }
      await bw.flush();
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as an iterable over the lines.
 */
export class StringIterableOutputHandler
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
