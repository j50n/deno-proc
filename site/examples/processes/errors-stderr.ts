import { ExitCodeError, run } from "@j50n/proc";

try {
  await run(
    {
      fnStderr: (stderr) => stderr.lines.collect(),
      fnError: (error, stderrLines) => {
        if (error instanceof ExitCodeError) {
          const detail = stderrLines?.join("; ") ?? "";
          throw new Error(`backup failed (exit ${error.code}): ${detail}`, {
            cause: error,
          });
        }
        if (error) throw error;
      },
    },
    "sh",
    "-c",
    "echo 'writing archive' >&2; echo 'disk full' >&2; exit 4",
  ).lines.collect();
} catch (error) {
  if (error instanceof Error) console.log(error.message);
}
