import { BufWriter } from "../../deps.ts";
import { MultiCloseProcess, MultiCloseReader, MultiCloseWriter } from "../closers.ts";
import { InputHandler } from "../process-group.ts";
import { stderrLinesToConsoleError } from "../stderr-support.ts";
import { DEFAULT_BUFFER_SIZE } from "../utility.ts";
import { AbstractBytesOutputHandler } from "./abstract-handlers.ts";

export function BytesIterableInput(
  autoflush = true,
): InputHandler<AsyncIterable<Uint8Array>> {
  return new BytesIterableInputHandler(autoflush);
}

/**
 * Source `stdin` from an iterable of byte arrays.
 */
export class BytesIterableInputHandler
  implements InputHandler<AsyncIterable<Uint8Array>> {
  constructor(public readonly autoflush: boolean) {
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
   processStderr: (
     lines: AsyncIterable<string>,
   ) => Promise<unknown | string[]> ,
 ) {
   super(processStderr);
 }

 processOutput(
   stdout: MultiCloseReader,
   stderr: MultiCloseReader,
   process: MultiCloseProcess,
   input: Promise<void>,
 ): AsyncIterable<Uint8Array> {
   return this.process(stdout, stderr, process, input);
 }
}
