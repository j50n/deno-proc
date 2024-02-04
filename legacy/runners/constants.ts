import { isWindows } from "https://deno.land/std@0.214.0/path/_os.ts";

export const LINESEP: string = (() => {
  if (isWindows) {
    return "\r\n";
  } else {
    return "\n";
  }
})();
