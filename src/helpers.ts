import { RunOptions } from "./run.ts";

export function parseArgs(
  cmd: unknown[],
): { options: RunOptions; command: string | URL; args: string[] } {
  let options: RunOptions = {};
  let command: string | URL = "";
  let args: string[] = [];

  if (cmd.length === 0) {
    throw new RangeError("empty arguments");
  } else if (typeof cmd[0] === "string" || cmd[0] instanceof URL) {
    /* No options defined. */
    options = {};
    command = cmd[0];
    args = cmd.slice(1) as string[];
  } else {
    /* First item is the options object. */
    if (cmd.length === 1) {
      throw new RangeError("missing command");
    }
    options = cmd[0] as RunOptions;
    command = cmd[1] as string | URL;
    args = cmd.slice(2) as string[];
  }

  return { options, command, args };
}

export function bestTypeNameOf(item: unknown): string {
  if (item == null) {
    return `${item}`;
  } else if (typeof item === "object") {
    if (Array.isArray(item)) {
      return "Array[...]";
    } else {
      return item.constructor.name;
    }
  } else {
    return typeof item;
  }
}
