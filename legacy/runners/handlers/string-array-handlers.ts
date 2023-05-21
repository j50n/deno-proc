import { BufWriter } from "../../deps.ts";
import { optionalChain } from "../chained-error.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { LINESEP } from "../constants.ts";
import { ErrorHandler } from "../error-support.ts";
import { InputHandler } from "../proc-group.ts";
import { StderrProcessor } from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractTextOutputHandler } from "./abstract-handlers.ts";

/**
 * Source `stdin` from a `string[]`. `stdin` is closed once the text data is written.
 */
export class StringArrayInputHandler implements InputHandler<string[]> {
  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(input: string[], stdin: MultiCloseWriter): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const linesep = encoder.encode(LINESEP);

      const buf = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
      try {
        for (const line of input) {
          await buf.write(encoder.encode(line));
          await buf.write(linesep);
        }
      } finally {
        await buf.flush();
      }
    } catch (e) {
      throw optionalChain(`${this.constructor.name}.processInput`, e);
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as a `string[]`.
 */
export class StringArrayOutputHandler
  extends AbstractTextOutputHandler<string[]> {
  constructor(
    processStderr: StderrProcessor,
    errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): Promise<string[]> {
    const lines = [];

    for await (const line of this.process(stdout, stderr, process, input)) {
      lines.push(line);
    }

    return lines;
  }
}
