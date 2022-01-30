import { InputHandler } from "../proc-group.ts";
import { ReaderInputHandler } from "./reader-handlers.ts";

/**
 * Handler for `Deno.Reader` input.
 */
export function readerInput(): InputHandler<Deno.Reader> {
  return new ReaderInputHandler();
}
