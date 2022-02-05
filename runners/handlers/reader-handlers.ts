import { optionalChain } from "../chained-error.ts";
import { MultiCloseWriter, NoCloseReader } from "../closers.ts";
import { InputHandler } from "../proc-group.ts";
import { pump, pumpUnbuffered } from "../utility.ts";

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
    try {
      await pump(new NoCloseReader(input), stdin);
    } catch (e) {
      throw optionalChain(`${this.constructor.name}.processInput`, e);
    }
  }
}

/**
 * Process input is a `Deno.Reader`, unbuffered.
 */
export class ReaderUnbufferedInputHandler implements InputHandler<Deno.Reader> {
  get failOnEmptyInput(): boolean {
    return true;
  }

  async processInput(
    input: Deno.Reader,
    stdin: MultiCloseWriter,
  ): Promise<void> {
    try {
      await pumpUnbuffered(new NoCloseReader(input), stdin);
    } catch (e) {
      throw optionalChain(`${this.constructor.name}.processInput`, e);
    }
  }
}
