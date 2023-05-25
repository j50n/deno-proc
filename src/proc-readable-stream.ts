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

/**
 * Convert a `ReadableStream` into a `ProcReadableStream` as needed, avoiding
 * redundant wrappers.
 * @param input Any `ReadableStream`.
 * @returns A `ProcReadableStream` wrapper.
 */
export function toProcReadableStream<R>(
  input: ReadableStream<R>,
): ProcReadableStream<R> {
  if (input instanceof ProcReadableStream) {
    return input;
  } else {
    return new ProcReadableStream(input);
  }
}

/**
 * Convert UTF8-encoded input to text chunks.
 * @param input UTF8-encoded input.
 * @returns Text chunks.
 */
export function text(input: ReadableStream<Uint8Array> | Deno.ChildProcess) {
  let s: ReadableStream<Uint8Array>;
  if ("stdout" in input) {
    s = input.stdout;
  } else {
    s = input;
  }

  return toProcReadableStream(s).pipeThrough(new TextDecoderStream());
}

/**
 * Convert UTF8-encoded input to text lines.
 *
 * @param input UTF8-encoded input.
 * @returns Text lines.
 */
export function lines(input: ReadableStream<Uint8Array> | Deno.ChildProcess) {
  return text(input).pipeThrough(new TextLineStream());
}

/**
 * Convert text data into UTF8-encoded bytes.
 * @param input Text data, either chunked or as lines.
 * @param options Options.
 * @returns
 */
export function bytes(
  input: ReadableStream<string>,
  options?: { chunked?: boolean },
) {
  //TODO: needs a coallescing transform.

  if (options?.chunked) {
    return toProcReadableStream(input.pipeThrough(new TextEncoderStream()));
  } else {
    return toProcReadableStream(
      input.pipeThrough(new AddEOLStream()).pipeThrough(
        new TextEncoderStream(),
      ),
    );
  }
}

export interface RunFnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

function parseArgs(
  optionsOrCmd: RunFnOptions | string,
  ...rest: string[]
): { options: RunFnOptions; cmd: string; args: string[] } {
  let options: RunFnOptions = {};
  let cmd = "";
  let args: string[] = [];
  if (typeof optionsOrCmd !== "string") {
    options = optionsOrCmd;
    cmd = rest[0];
    args = rest.slice(1);
  } else {
    options = {};
    cmd = optionsOrCmd;
    args = rest;
  }
  return { options, cmd, args };
}

/**
 * Run a process.
 * @param cmd The command.
 * @param options Options.
 * @returns A child process instance.
 */
export async function execute(
  options: RunFnOptions,
  cmd: string,
  ...args: string[]
): Promise<void>;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
 */
export async function execute(cmd: string, ...args: string[]): Promise<void>;

/**
 * Spawn a process, interpret its output as lines, and print them
 * to `console.log()`.
 * @param cmd The command.
 * @param options Options.
 */
export async function execute(
  optionsOrCmd: RunFnOptions | string,
  ...rest: string[]
): Promise<void> {
  const { options, cmd, args } = parseArgs(optionsOrCmd, ...rest);

  for await (const line of lines(run(options, cmd, ...args))) {
    console.log(line);
  }
}

/**
 * Run a process.
 * @param cmd The command.
 * @param options Options.
 * @returns A child process instance.
 */
export function run(
  options: RunFnOptions,
  cmd: string,
  ...args: string[]
): ProcChildProcess;

/**
 * Run a process.
 * @param cmd The command.
 * @returns A child process instance.
 */
export function run(cmd: string, ...args: string[]): ProcChildProcess;

export function run(
  optionsOrCmd: RunFnOptions | string,
  ...rest: string[]
): ProcChildProcess {
  const { options, cmd, args } = parseArgs(optionsOrCmd, ...rest);

  const p = new ProcChildProcess(
    new Deno.Command(cmd, {
      args: args,
      cwd: options?.cwd,
      env: options?.env,
      stdout: "piped",
    }).spawn(),
  );

  return p;
}

export class ProcReadableStream<R> implements ReadableStream<R> {
  constructor(protected readonly source: ReadableStream<R>) {
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

  async collect() {
    const result: R[] = [];

    for await (const item of this) {
      result.push(item);
    }

    return result;
  }

  /**
   * Run a process.
   *
   * Note that this is not type safe. This should only be called on a
   * `ProcReadableStream<Uint8Array>`. Calling this for other types will
   * cause a runtime error.
   *
   * @param cmd The command.
   * @param options Options.
   * @returns A child process instance.
   */
  run(
    options: RunFnOptions,
    cmd: string,
    ...args: string[]
  ): ProcChildProcess;

  /**
   * Run a process.
   *
   * Note that this is not type safe. This should only be called on a
   * `ProcReadableStream<Uint8Array>`. Calling this for other types will
   * cause a runtime error.
   *
   * @param cmd The command.
   * @returns A child process instance.
   */
  run(cmd: string, ...args: string[]): ProcChildProcess;

  run(
    optionsOrCmd: RunFnOptions | string,
    ...rest: string[]
  ): ProcChildProcess {
    const { options, cmd, args } = parseArgs(optionsOrCmd, ...rest);

    const p = new ProcChildProcess(
      new Deno.Command(cmd, {
        args: args,
        cwd: options?.cwd,
        env: options?.env,
        stdin: "piped",
        stdout: "piped",
      }).spawn(),
    );

    (this as ReadableStream<Uint8Array>).pipeTo(p.stdin);

    return p;
  }
}

export class ProcChildProcess implements Deno.ChildProcess {
  private _stdout: ProcReadableStream<Uint8Array> | null = null;
  private _stderr: ProcReadableStream<Uint8Array> | null = null;

  constructor(protected child: Deno.ChildProcess) {
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

  /**
   * Run a process.
   *
   * @param cmd The command.
   * @param options Options.
   * @returns A child process instance.
   */
  run(
    options: RunFnOptions,
    cmd: string,
    ...args: string[]
  ): ProcChildProcess;

  /**
   * Run a process.
   *
   * @param cmd The command.
   * @returns A child process instance.
   */
  run(cmd: string, ...args: string[]): ProcChildProcess;

  run(
    optionsOrCmd: RunFnOptions | string,
    ...rest: string[]
  ): ProcChildProcess {
    const { options, cmd, args } = parseArgs(optionsOrCmd, ...rest);

    const p = new ProcChildProcess(
      new Deno.Command(cmd, {
        args: args,
        cwd: options?.cwd,
        env: options?.env,
        stdin: "piped",
        stdout: "piped",
      }).spawn(),
    );

    this.stdout.pipeTo(p.stdin);

    return p;
  }

  /**
   * The bytes from `stdout`.
   */
  async collect() {
    return await this.stdout.collect();
  }

  /**
   * The `stdout` data as a string.
   */
  async asString() {
    return (await text(this.stdout).collect()).join("");
  }

  /**
   * Collect `stdout` as lines of text.
   */
  async collectLines() {
    return await lines(this.stdout).collect();
  }
}
