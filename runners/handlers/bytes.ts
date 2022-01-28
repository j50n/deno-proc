import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { concat } from "../utility.ts";
import { AbstractBytesOutputHandler } from "./abstract-handlers.ts";

export function bytesInput(): InputHandler<Uint8Array> {
  return new BytesInputHandler();
}

export function bytesOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<Uint8Array> {
  return new BytesOutputHandler(processStderr, errorHandler);
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
    public readonly processStderr: StderrProcessor,
    public readonly errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ): Promise<Uint8Array> {
    const bytes: Uint8Array[] = [];
    for await (const b of this.process(stdout, stderr, process, input)) {
      bytes.push(b);
    }
    return concat(bytes);
  }
}
