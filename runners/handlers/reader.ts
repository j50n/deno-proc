import { MultiCloseWriter, NoCloseReader } from "../closers.ts";
import { InputHandler } from "../proc-group.ts";
import { pump } from "../utility.ts";

/**
 * Process input is a `Deno.Reader`.
 */
export function readerInput(): InputHandler<Deno.Reader> {
  return new ReaderInputHandler();
}

/**
 * Process input is a `Deno.Reader`.
 */
export class ReaderInputHandler implements InputHandler<Deno.Reader> {
  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: Deno.Reader,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    await pump(new NoCloseReader(input), stdin);
  }
}
