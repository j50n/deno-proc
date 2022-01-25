import { MultiCloseWriter } from "../closers.ts";
import { InputHandler } from "../proc-group.ts";
import { pump } from "../utility.ts";

export function readerInput(): InputHandler<Deno.Reader & Deno.Closer> {
  return new ReaderInputHandler();
}

/**
 * Source `stdin` from a `Reader`.
 */
export class ReaderInputHandler
  implements InputHandler<Deno.Reader & Deno.Closer> {
  get failOnEmptyInput(): boolean {
    return true;
  }
  async processInput(
    input: Deno.Reader & Deno.Closer,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    await pump(input, stdin);
  }
}
