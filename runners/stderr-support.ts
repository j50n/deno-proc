import { toLines } from "./utility.ts";

/** A processor for `stderr`. */
export type StderrProcessor = (
  bytes: AsyncIterable<Uint8Array>,
) => Promise<unknown | string[]>;

/**
 * Write `stderr` lines to `console.error()`.
 * @param lines `stderr` lines.
 */
export async function stderrLinesToConsoleError(
  bytes: AsyncIterable<Uint8Array>,
): Promise<void> {
  for await (const b of bytes) {
    Deno.stderr.writeSync(b);
  }
}

/**
 * Ignore stderr.
 * @param _lines `stderr` lines.
 */
export async function stderrLinesToNull(
  _bytes: AsyncIterable<Uint8Array>,
): Promise<void> {
}

/**
 * Write `stderr` lines to the error message, if the process fails; otherwise, `stderr` is suppressed.
 * @param tail The number of lines at the end of `stderr` to keep.
 */
export function stderrLinesToErrorMessage(
  tail = 20,
): (bytes: AsyncIterable<Uint8Array>) => Promise<string[]> {
  async function stderrLinesToErrorMessageLimited(
    bytes: AsyncIterable<Uint8Array>,
  ): Promise<string[]> {
    let droppedLines = false;

    const linesArray = [];
    for await (const line of toLines(bytes)) {
      linesArray.push(line);
      if (linesArray.length > tail) {
        linesArray.shift();
        droppedLines = true;
      }
    }

    if (droppedLines) {
      linesArray.unshift("...");
    }

    return linesArray;
  }

  return stderrLinesToErrorMessageLimited;
}
