import { isWindows } from "https://deno.land/std@0.146.0/_util/os.ts";

export const LINESEP: string = (() => {
  if (isWindows) {
    return "\r\n";
  } else {
    return "\n";
  }
})();
