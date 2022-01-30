import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { BytesInputHandler, BytesOutputHandler } from "./bytes-handlers.ts";

/**
 * A handler for `Uint8Array` input.
 */
export function bytesInput(): InputHandler<Uint8Array> {
  return new BytesInputHandler();
}

/**
 * A hander for `Uint8Array` output.
 * @param processStderr A custom processor for `stderr`.
 * @param errorHandler A custom error handler.
 */
export function bytesOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<Uint8Array> {
  return new BytesOutputHandler(processStderr, errorHandler);
}
