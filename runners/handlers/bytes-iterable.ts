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
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractBytesOutputHandler } from "./abstract-handlers.ts";

export function bytesIterableInput(
  autoflush = true,
): InputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableInputHandler(autoflush);
}

export function bytesIterableOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableOutputHandler(processStderr, errorHandler);
}

/**
 * Source `stdin` from an iterable of byte arrays.
 */
export class BytesIterableInputHandler
  implements InputHandler<AsyncIterable<Uint8Array>> {
  constructor(public readonly autoflush: boolean) {
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
      if (e instanceof Deno.errors.BrokenPipe) {
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
