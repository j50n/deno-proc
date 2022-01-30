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
import { AbstractBytesOutputHandler } from "./abstract-handlers.ts";

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
    try {
      const bw = new BufWriter(stdin, DEFAULT_BUFFER_SIZE);
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
        throw e;
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
    public readonly processStderr: StderrProcessor,
    public readonly errorHandler: ErrorHandler,
  ) {
    super(processStderr, errorHandler);
  }

  processOutput(
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: { stdin: MultiCloseWriter; handlerResult: Promise<void> },
  ): AsyncIterable<Uint8Array> {
    return this.process(stdout, stderr, process, input);
  }
}
