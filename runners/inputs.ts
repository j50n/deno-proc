import { MultiCloseWriter } from "./closers.ts";
import { InputHandler } from "./process-group.ts";
import { pump } from "./utility.ts";

/**
 * Empty `stdin`.
 */
export class NullInput implements InputHandler<void> {
  async processInput(_input: void, stdin: MultiCloseWriter): Promise<void> {
    stdin.close();
    await Promise.resolve(undefined);
  }
}

/**
 * Source `stdin` from a `Reader`.
 */
export class ReaderInput implements InputHandler<Deno.Reader & Deno.Closer> {
  async processInput(
    input: Deno.Reader & Deno.Closer,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    await pump(input, stdin);
  }
}
