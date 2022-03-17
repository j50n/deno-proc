import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";
import { debug } from "./debugging.ts";
import {
  Group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./proc-group.ts";
import { randomString } from "./utility.ts";

const groupRegistry = new Map<string, Group>();

function closeGroupsEvent(_e: Event): void {
  if (debug()) console.error(`event: closing proc-groups`);

  for (const pg of groupRegistry.values()) {
    try {
      pg.close();
    } catch (e) {
      if (debug()) console.error(e);
    }
  }
}

self.addEventListener("unload", closeGroupsEvent);

export interface Process {
  process: MultiCloseProcess;
  stdin: MultiCloseWriter;
  stdout: MultiCloseReader;
  stderr: MultiCloseReader;
}

export class GroupImpl implements Group {
  readonly processes: Map<number, Process> = new Map();
  readonly id = randomString(10);

  constructor() {
    groupRegistry.set(this.id, this);
  }

  close(): void {
    if (debug()) console.error(`close proc-group ${this.processes}`);

    groupRegistry.delete(this.id);

    for (const [_, process] of this.processes.entries()) {
      if (debug()) console.error("closing process");
      process.stdin.close();
      process.stdout.close();
      process.stderr.close();
      process.process.close();
    }
    this.processes.clear();
  }

  run<A, B>(
    inputHandler: InputHandler<A>,
    outputHandler: OutputHandler<B>,
    input: A,
    options: RunOptions,
  ): B | Promise<B> {
    const process = Deno.run({
      ...options,
      stdin: "piped",
      stdout: "piped",
      stderr: "piped",
    });

    const stdin = new MultiCloseWriter(process.stdin);
    const stdout = new MultiCloseReader(process.stdout);
    const stderr = new MultiCloseReader(process.stderr);

    const processWrapper = new MultiCloseProcess(process, options, this);
    this.processes.set(processWrapper.pid, {
      process: processWrapper,
      stdin,
      stdout,
      stderr,
    });

    const inputResult: Promise<null | Error> = (async () => {
      try {
        await inputHandler.processInput(input, stdin);
        return null;
      } catch (e) {
        return e as Error;
      }
    })();

    console.error(`RUN ->  ${JSON.stringify(options)}`);

    return outputHandler.processOutput(
      stdout,
      stderr,
      processWrapper,
      { stdin, handlerResult: inputResult },
    );
  }
}
