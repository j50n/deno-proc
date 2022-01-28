import { defaultErrorHandling, ErrorHandler } from "../error-support.ts";
import { InputHandler, OutputHandler } from "../proc-group.ts";
import {
  stderrLinesToConsoleError,
  StderrProcessor,
} from "../stderr-support.ts";
import { BytesInputHandler, BytesOutputHandler } from "./bytes-handlers.ts";

export function bytesInput(): InputHandler<Uint8Array> {
  return new BytesInputHandler();
}

export function bytesOutput(
  processStderr: StderrProcessor = stderrLinesToConsoleError,
  errorHandler: ErrorHandler = defaultErrorHandling,
): OutputHandler<Uint8Array> {
  return new BytesOutputHandler(processStderr, errorHandler);
}
