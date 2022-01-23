import { MultiCloseWriter } from "../closers.ts";
import { InputHandler } from "../process-group.ts";

export function EmptyInput() {
  return new EmptyInputHandler();
}

/**
 * Empty `stdin`.
 */
export class EmptyInputHandler implements InputHandler<void> {
  async processInput(_input: void, stdin: MultiCloseWriter): Promise<void> {
    stdin.close();
    await Promise.resolve(undefined);
  }
}
