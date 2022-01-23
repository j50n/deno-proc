import { MultiCloseWriter } from "../closers.ts";
import { InputHandler } from "../process-group.ts";
import { pump } from "../utility.ts";

export function ReaderInput(): InputHandler<Deno.Reader & Deno.Closer> {
  return new ReaderInputHandler();
}

/**
 * Source `stdin` from a `Reader`.
 */
export class ReaderInputHandler
  implements InputHandler<Deno.Reader & Deno.Closer> {
  async processInput(
    input: Deno.Reader & Deno.Closer,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    await pump(input, stdin);
  }
}
