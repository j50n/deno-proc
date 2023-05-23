import { TextLineStream } from "../tests/deps/streams.ts";

class AddEOLStream extends TransformStream<string, string> {
  constructor() {
    super({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController,
      ) => {
        controller.enqueue(chunk);
        controller.enqueue("\n");
      },
    });
  }
}

abstract class BaseChainable<R> {
  protected abstract chainableOutput: ProcReadableStream<Uint8Array>;

  spawn(
    cmd: string,
    options?: { args?: string[]; cwd?: string },
  ): ProcChildProcess {
    const p = new ProcChildProcess(
      new Deno.Command(cmd, {
        args: options?.args,
        cwd: options?.cwd,
        stdin: "piped",
        stdout: "piped",
      }).spawn(),
    );
    this.chainableOutput.pipeTo(p.stdin);
    return p;
  }

  /**
   * Stream as text chunks. The split is arbitrary, based on the
   * character buffer. This is _not_ split on EOL. This is good
   * for processing text quickly when line splits are not important.
   * @returns The stream as text chunks.
   */
  asText(): ProcReadableStream<string> {
    return this.chainableOutput.pipeThrough(
      new TextDecoderStream(),
    );
  }

  /**
   * Stream as lines of text, split on EOL.
   * @returns The stream as lines of text.
   */
  asLines(): ProcReadableStream<string> {
    return this.chainableOutput.pipeThrough(
      new TextDecoderStream(),
    ).pipeThrough(new TextLineStream());
  }

  /**
   * Gather the lines of text from the output and return them as an array.
   * This waits for the process to complete and returns all lines at once,
   * or not at all in the case of an error.
   * @returns The text lines as an array.
   */
  async lines(): Promise<string[]> {
    const result: string[] = [];

    for await (const line of this.asLines()) {
      result.push(line);
    }

    return result;
  }
}

/**
 * Spawn a process.
 * @param cmd The command.
 * @param options Options.
 * @returns A child process instance.
 */
export function spawn(
  cmd: string,
  options?: { args?: string[]; cwd?: string },
): ProcChildProcess {
  const p = new ProcChildProcess(
    new Deno.Command(cmd, {
      args: options?.args,
      cwd: options?.cwd,
      stdout: "piped",
    }).spawn(),
  );

  return p;
}

export class ProcReadableStream<R> extends BaseChainable<R>
  implements ReadableStream<R> {
  constructor(protected readonly source: ReadableStream<R>) {
    super();
  }

  override get chainableOutput(): ProcReadableStream<Uint8Array> {
    return this as ProcReadableStream<Uint8Array>;
  }

  get locked(): boolean {
    return this.source.locked;
  }

  async cancel(reason?: unknown): Promise<void> {
    await this.cancel(reason);
  }

  getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
  getReader(options?: { mode?: undefined }): ReadableStreamDefaultReader<R>;

  getReader(
    // deno-lint-ignore no-explicit-any
    options?: any,
  ): ReadableStreamBYOBReader | ReadableStreamDefaultReader<R> {
    return this.source.getReader(options);
  }

  async pipeTo(dest: WritableStream<R>, options?: PipeOptions): Promise<void> {
    await this.source.pipeTo(dest, options);
  }

  pipeThrough<T>(
    transform: { writable: WritableStream<R>; readable: ReadableStream<T> },
    options?: PipeOptions,
  ): ProcReadableStream<T> {
    return new ProcReadableStream(
      this.source.pipeThrough(
        transform,
        options,
      ),
    );
  }

  tee(): [ProcReadableStream<R>, ProcReadableStream<R>] {
    const [s1, s2] = this.source.tee();
    return [new ProcReadableStream(s1), new ProcReadableStream(s2)];
  }

  [Symbol.asyncIterator](
    options?: { preventCancel?: boolean },
  ): AsyncIterableIterator<R> {
    return this.source[Symbol.asyncIterator](options);
  }

  asBytes(options?: { addEOL?: boolean }) {
    if (options?.addEOL) {
      return (this as ProcReadableStream<string>).pipeThrough(
        new AddEOLStream(),
      ).pipeThrough(new TextEncoderStream());
    } else {
      return (this as ProcReadableStream<string>).pipeThrough(
        new TextEncoderStream(),
      );
    }
  }
}

export class ProcChildProcess extends BaseChainable<Uint8Array> {
  private _stdout: ProcReadableStream<Uint8Array> | null = null;
  private _stderr: ProcReadableStream<Uint8Array> | null = null;

  constructor(protected child: Deno.ChildProcess) {
    super();
  }

  protected get chainableOutput(): ProcReadableStream<Uint8Array> {
    return this.stdout;
  }

  get stdout() {
    if (this._stdout === null) {
      this._stdout = new ProcReadableStream(this.child.stdout);
    }
    return this._stdout;
  }

  get stderr() {
    if (this._stderr === null) {
      this._stderr = new ProcReadableStream(this.child.stderr);
    }
    return this._stderr;
  }

  get stdin() {
    return this.child.stdin;
  }

  get status() {
    return this.child.status;
  }

  get pid() {
    return this.child.pid;
  }

  kill(signo?: Deno.Signal) {
    this.child.kill(signo);
  }

  async output() {
    return await this.child.output();
  }

  ref() {
    return this.child.ref();
  }

  unref() {
    return this.child.unref();
  }

  pipeThrough<T>(
    transform: {
      writable: WritableStream<Uint8Array>;
      readable: ReadableStream<T>;
    },
    options?: PipeOptions,
  ): ProcReadableStream<T> {
    return new ProcReadableStream(
      this.stdout.pipeThrough(
        transform,
        options,
      ),
    );
  }
}
