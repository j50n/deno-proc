import { InputHandler } from "../proc-group.ts";
import { ReaderInputHandler } from "./reader-handlers.ts";

/**
 * Process input is a `Deno.Reader`.
 */
export function readerInput(): InputHandler<Deno.Reader> {
  return new ReaderInputHandler();
}
