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
import { concat, DEFAULT_BUFFER_SIZE } from "../utility.ts";
import {
  AbstractTextOutputHandler,
  AbstractTextUnbufferedOutputHandler,
} from "./abstract-handlers.ts";

/**
 * Source `stdin` from an iterable of lines.
 */
export class StringAsyncIterableInputHandler
  implements InputHandler<AsyncIterable<string>> {
  constructor(public readonly autoflush: boolean) {
  }

  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: AsyncIterable<string>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const linesep = encoder.encode(LINESEP);

      const bw = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
      try {
        for await (const line of input) {
          await bw.write(encoder.encode(line));
          await bw.write(linesep);
          if (this.autoflush) {
            await bw.flush();
          }
        }
      } finally {
        await bw.flush();
      }
    } catch (e) {
      if (
        e instanceof Deno.errors.BrokenPipe ||
        e instanceof Deno.errors.Interrupted
      ) {
        // Ignore.
      } else {
        throw optionalChain(`${this.constructor.name}.processInput`, e);
      }
    } finally {
      stdin.close();
    }
  }
}

/**
 * Source `stdin` from an iterable of lines, unbuffered.
 */
export class StringAsyncIterableUnbufferedInputHandler
  implements InputHandler<AsyncIterable<string>> {
  constructor() {
  }

  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: AsyncIterable<string>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      const encoder = new TextEncoder();
      const linesep = encoder.encode(LINESEP);

      for await (const line of input) {
        await stdin.write(concat([encoder.encode(line), linesep]));
      }
    } catch (e) {
      if (
        e instanceof Deno.errors.BrokenPipe ||
        e instanceof Deno.errors.Interrupted
      ) {
        // Ignore.
      } else {
        throw optionalChain(`${this.constructor.name}.processInput`, e);
      }
    } finally {
      stdin.close();
    }
  }
}

/**
 * Return `stdout` as an iterable over the lines.
 */
export class StringAsyncIterableOutputHandler
  extends AbstractTextOutputHandler<AsyncIterable<string>> {
  constructor(
    processStderr: StderrProcessor,
    errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async *processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): AsyncIterableIterator<string> {
    yield* this.process(stdout, stderr, process, input);
  }
}

/**
 * Return `stdout` as an iterable over the lines, unbuffered.
 */
export class StringAsyncIterableUnbufferedOutputHandler
  extends AbstractTextUnbufferedOutputHandler<AsyncIterable<string>> {
  constructor(
    processStderr: StderrProcessor,
    errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  async *processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<null | Error> },
  ): AsyncIterableIterator<string> {
    yield* this.process(stdout, stderr, process, input);
  }
}
