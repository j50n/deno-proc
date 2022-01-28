import { EmptyInputHandler } from "./empty-handlers.ts";

export function emptyInput() {
  return new EmptyInputHandler();
}
