import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";
import { debug } from "./debugging.ts";
import { randomString } from "./utility.ts";

const procGroupRegistry = new Map<string, ProcGroup>();

function closeProcGroupsEvent(_e: Event): void {
  if (debug()) console.error(`event: closing proc-groups`);

  for (const pg of procGroupRegistry.values()) {
    try {
      pg.close();
    } catch (e) {
      if (debug()) console.error(e);
    }
  }
}

self.addEventListener("unload", closeProcGroupsEvent);

export interface InputHandler<A> {
  get failOnEmptyInput(): boolean;
  processInput: (input: A, stdin: MultiCloseWriter) => Promise<void>;
}

export interface OutputHandler<B> {
  /**
   * Handle the output (stdout, stderr, and exit status) of a process.
   * @throws ProcessExitError A process returned an exit code that indicated that an error occurred.
   */
  processOutput: (
    stdout: MultiCloseReader,
    stderr: MultiCloseReader,
    process: MultiCloseProcess,
    input: Promise<void>,
  ) => B | Promise<B>;
}

export interface RunOptions {
  cmd: string[] | [URL, ...string[]];
  cwd?: string;
  env?: {
    [key: string]: string;
  };
}

interface Process {
  process: MultiCloseProcess;
  stdin: MultiCloseWriter;
  stdout: MultiCloseReader;
  stderr: MultiCloseReader;
}

export function procGroup(): ProcGroup {
  return new ProcGroup();
}

export class ProcGroup implements Deno.Closer {
  protected processes: Process[] = [];
  public readonly id = randomString(10);

  constructor() {
    procGroupRegistry.set(this.id, this);
  }

  close(): void {
    if (debug()) console.error(`close proc-group ${this.processes}`);

    procGroupRegistry.delete(this.id);

    while (this.processes.length > 0) {
      const p = this.processes.pop()!;
      if (debug()) console.error("closing process");
      p.stdin.close();
      p.stdout.close();
      p.stderr.close();
      p.process.close();
    }
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

    const processWrapper = new MultiCloseProcess(process);
    this.processes.push({ process: processWrapper, stdin, stdout, stderr });

    const inputResult = inputHandler.processInput(input, stdin);

    return outputHandler.processOutput(
      stdout,
      stderr,
      processWrapper,
      inputResult,
    );
  }
}
