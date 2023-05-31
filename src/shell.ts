// deno-lint-ignore-file no-inner-declarations
import { readableStreamFromIterable } from "./deps/streams.ts";
import { WritableIterable } from "./writable-iterable.ts";
import { map } from "./deps/asynciter.ts";

export type PipeKinds = "piped" | "inherit" | "null";

export async function pipeTo<T>(
  src: AsyncIterable<T>,
  dest: WritableIterable<T>,
) {
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

  stdin?: PipeKinds;
  stdout?: PipeKinds;
  stderr?: PipeKinds;
}

export class AsyncIterableRunnable<T> {
  constructor(protected readonly iterator: AsyncIterable<T>) {
  }

  public async *[Symbol.asyncIterator](): AsyncGenerator<T, void, unknown> {
    for await (const item of this.iterator) {
      yield item;
    }
  }

  /**
   * Map the sequence from one type to another.
   * @param mapFn The mapping function.
   * @returns An iterable of mapped values.
   */
  public map<U>(mapFn: (item: T) => U | Promise<U>) {
    const iterable = this.iterator;
    return new AsyncIterableRunnable({
      async *[Symbol.asyncIterator]() {
        yield* map(iterable, mapFn);
      },
    });
  }
}

export class Process implements Deno.Closer {
  constructor(
    public shell: Shell,
    protected readonly process: Deno.ChildProcess,
  ) {}

  private _stderr: AsyncIterableRunnable<Uint8Array> | undefined;
  private _stdout: AsyncIterableRunnable<Uint8Array> | undefined;
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

  get stderr() {
    if (this._stderr == null) {
      const process = this.process;
      async function* gen() {
        yield* process.stderr;
      }
      this._stderr = new AsyncIterableRunnable(gen());
    }
    return this._stderr;
  }

  get stdout() {
    if (this._stdout == null) {
      const process = this.process;
      async function* gen() {
        yield* process.stdout;
      }
      this._stdout = new AsyncIterableRunnable(gen());
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

export class Command {
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
    return new Process(
      this.shell,
      new Deno.Command(this.cmd, { ...this.options, args: [...this.args] })
        .spawn(),
    );
  }
}
