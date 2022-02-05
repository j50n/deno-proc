import { optionalChain } from "../chained-error.ts";
import { BufWriter } from "../../deps.ts";
import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "../closers.ts";
import { ErrorHandler } from "../error-support.ts";
import { InputHandler } from "../proc-group.ts";
import { StderrProcessor } from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import {
  AbstractBytesOutputHandler,
  AbstractBytesUnbufferedOutputHandler,
} from "./abstract-handlers.ts";

/**
 * Source `stdin` from an iterable of byte arrays.
 */
export class BytesIterableInputHandler
  implements InputHandler<AsyncIterable<Uint8Array>> {
  constructor() {
  }

  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: AsyncIterable<Uint8Array>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    const bw = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
    try {
      for await (const byteArray of input) {
        await bw.write(byteArray);
      }
      await bw.flush();
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
 * Source `stdin` from an iterable of byte arrays, unbuffered.
 */
export class BytesIterableUnbufferedInputHandler
  implements InputHandler<AsyncIterable<Uint8Array>> {
  constructor() {
  }

  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: AsyncIterable<Uint8Array>,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      for await (const byteArray of input) {
        await stdin.write(byteArray);
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
export class BytesIterableOutputHandler
  extends AbstractBytesOutputHandler<AsyncIterable<Uint8Array>> {
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
  ): AsyncIterable<Uint8Array> {
    yield* this.process(stdout, stderr, process, input);
  }
}

/**
 * Return `stdout` as an iterable over the lines, unbuffered.
 */
export class BytesIterableUnbufferedOutputHandler
  extends AbstractBytesUnbufferedOutputHandler<AsyncIterable<Uint8Array>> {
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
  ): AsyncIterable<Uint8Array> {
    yield* this.process(stdout, stderr, process, input);
  }
}
