import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import { stderrLinesToConsoleError } from "../stderr-support.ts";
import { concat } from "../utility.ts";
import { AbstractBytesOutputHandler } from "./abstract-handlers.ts";

export function BytesInput(): InputHandler<Uint8Array> {
  return new BytesInputHandler();
}

export function BytesOutput(
  processStderr: (
    lines: AsyncIterable<string>,
  ) => Promise<unknown | string[]> = stderrLinesToConsoleError,
): OutputHandler<Uint8Array> {
  return new BytesOutputHandler(processStderr);
}

/**
 * Source `stdin` from a `Uint8Array`. `stdin` is closed once the data is written.
 */
export class BytesInputHandler implements InputHandler<Uint8Array> {
  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: Uint8Array,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const writer = new BufWriter(stdin);
      await writer.write(input);
      await writer.flush();
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as a `Uint8Array`.
 */
export class BytesOutputHandler extends AbstractBytesOutputHandler<Uint8Array> {
  constructor(
    processStderr: (
      lines: AsyncIterable<string>,
    ) => Promise<unknown | string[]>,
  ) {
    super(processStderr);
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ): Promise<Uint8Array> {
    const bytes: Uint8Array[] = [];
    for await (const b of this.process(stdout, stderr, process, input)) {
      bytes.push(b);
    }
    return concat(bytes);
  }
}
