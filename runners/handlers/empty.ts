import { EmptyInputHandler } from "./empty-handlers.ts";

/**
 * A hander for `void` input.
 */
export function emptyInput() {
  return new EmptyInputHandler();
}
