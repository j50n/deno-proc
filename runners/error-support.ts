import { RunOptions } from "./proc-group.ts";
import { ProcessExitError } from "./process-exit-error.ts";

export type ErrorHandler = (
  options: RunOptions,
  status: Deno.ProcessStatus,
  stderrLines?: string[] | unknown,
) => void;

export function defaultErrorHandling(
  options: RunOptions,
  status: Deno.ProcessStatus,
  stderrLines?: string[] | unknown,
): void {
  if (!status.success) {
    let message = `process exited with code: ${status.code} `;
    if (status.signal !== undefined) {
      message += `(signal: ${status.signal})`;
    }

    message += ` [${options.cmd.join(" ")}]`;
    if (options.cwd !== undefined) {
      message += "@${cwd}";
    }

    throw new ProcessExitError(
      message,
      status.code,
      options,
      status.signal,
      Array.isArray(stderrLines) ? stderrLines : undefined,
    );
  }
}
