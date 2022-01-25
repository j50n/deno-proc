import { MultiCloseWriter } from "../closers.ts";
import { InputHandler } from "../proc-group.ts";

export function emptyInput() {
  return new EmptyInputHandler();
}

/**
 * Empty `stdin`.
 */
export class EmptyInputHandler implements InputHandler<void> {
  get failOnEmptyInput(): boolean {
    return false;
  }

  async processInput(_input: void, stdin: MultiCloseWriter): Promise<void> {
    stdin.close();
    await Promise.resolve(undefined);
  }
}
