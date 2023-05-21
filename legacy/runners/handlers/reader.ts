import { InputHandler } from "../proc-group.ts";
import {
  ReaderInputHandler,
  ReaderUnbufferedInputHandler,
} from "./reader-handlers.ts";

/**
 * Handler for `Deno.Reader` input.
 */
export function readerInput(): InputHandler<Deno.Reader> {
  return new ReaderInputHandler();
}

/**
 * Handler for `Deno.Reader` input, unbuffered.
 */
export function readerUnbufferedInput(): InputHandler<Deno.Reader> {
  return new ReaderUnbufferedInputHandler();
}
