// deno-lint-ignore-file no-inner-declarations
import { readableStreamFromIterable } from "./deps/streams.ts";
import { WritableIterable } from "./writable-iterable.ts";

export type PipeKinds = "piped" | "inherit" | "null";

export async function pipeTo<T>(src: AsyncIterable<T>, dest: WritableIterable<T>) {
  try {
    for await (const item of src) {
      dest.write(item);
    }
  } finally {
    dest.close();
  }
}

export async function* pipeThrough<T, U>(
  src: AsyncIterable<T>,
  transform: (item: T) => U | Promise<U>,
): AsyncIterableIterator<U> {
  for await (const item of src) {
    yield transform(item);
  }
}

export class Shell implements Deno.Closer {
  constructor() {}

  async close(): Promise<void> {
  }
}

/** Command options. */
export interface ProcIterOptions {
  /** Current working directory. */
  readonly cwd?: string;
  /** Environment variables. */
  readonly env?: Record<string, string>;

  stdin: PipeKinds;
  stdout: PipeKinds;
  stderr: PipeKinds;
}

export class ProcIterProcess implements Deno.Closer {
  constructor(
    public shell: Shell,
    protected readonly process: Deno.ChildProcess,
  ) {}

  private _stderr: AsyncIterableIterator<Uint8Array> | undefined;
  private _stdout: AsyncIterableIterator<Uint8Array> | undefined;
  private _stdin: WritableIterable<Uint8Array> | undefined;

  async close(): Promise<void> {
    if (this._stdin != null) {
      await this.stdin.close();
    }
  }

  get pid() {
    return this.process.pid;
  }

  async status() {
    return await this.process.status;
  }

  get stderr(): AsyncIterableIterator<Uint8Array> {
    if (this._stderr == null) {
      const process = this.process;
      async function* gen() {
        yield* process.stderr;
      }
      this._stderr = gen();
    }
    return this._stderr;
  }

  get stdout(): AsyncIterableIterator<Uint8Array> {
    if (this._stdout == null) {
      const process = this.process;
      async function* gen() {
        yield* process.stdout;
      }
      this._stdout = gen();
    }
    return this._stdout;
  }

  get stdin(): WritableIterable<Uint8Array> {
    if (this._stdin == null) {
      const pi = new WritableIterable<Uint8Array>({
        onclose: () => this.stdin.close(),
      });
      readableStreamFromIterable(pi).pipeTo(this.process.stdin);
      this._stdin = pi;
    }
    return this._stdin;
  }
}

export class ProcIter {
  readonly args: readonly string[];

  constructor(
    public shell: Shell,
    public readonly options: ProcIterOptions,
    public readonly cmd: string | URL,
    ...args: string[]
  ) {
    this.args = [...args];
  }

  spawn() {
    return new ProcIterProcess(
      this.shell,
      new Deno.Command(this.cmd, { ...this.options, args: [...this.args] })
        .spawn(),
    );
  }
}
