/**
 * Write `stderr` lines to `console.error()`.
 * @param lines `stderr` lines.
 */
export async function stderrLinesToConsoleError(
  lines: AsyncIterable<string>,
): Promise<void> {
  for await (const line of lines) {
    console.error(line);
  }
}

/**
 * Ignore stderr.
 * @param _lines `stderr` lines.
 */
export async function stderrLinesToNull(
  _lines: AsyncIterable<string>,
): Promise<void> {
}

/**
 * Write `stderr` lines to the error message, if the process fails; otherwise, `stderr` is suppressed.
 * @param tail The number of lines to keep.
 */
export function stderrLinesToErrorMessage(
  tail: number,
): (lines: AsyncIterable<string>) => Promise<string[]> {
  return async (lines: AsyncIterable<string>): Promise<string[]> => {
    let droppedLines = false;

    const linesArray = [];
    for await (const line of lines) {
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
  };
}