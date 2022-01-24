import {
  MultiCloseProcess,
  MultiCloseReader,
  MultiCloseWriter,
} from "./closers.ts";

export interface InputHandler<A> {
  get failOnEmptyInput(): boolean;
  processInput: (input: A, stdin: MultiCloseWriter) => Promise<void>;
}

export interface OutputHandler<B> {
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

export function procgroup(): ProcGroup {
  return new ProcGroup();
}

export class ProcGroup implements Deno.Closer {
  protected processes: Process[] = [];

  /**
   * Event handler registered to call close if we exit without explicitly closing.
   * @param _e The event.
   */
  private closer(_e: Event): void {
    try {
      this.close();
    } catch (e) {
      // Ignore.
      console.error(e);
    }
  }

  constructor() {
    self.addEventListener("unload", this.closer);
  }

  close(): void {
    try {
      self.removeEventListener("unload", this.closer);
    } catch {
      // Ignore.
    }

    while (this.processes.length > 0) {
      const p = this.processes.pop()!;
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
