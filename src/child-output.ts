// A child's stdout: read once, by proc's reader, or by proc itself once the
// child has exited, so the pipe never stays open. Internal; `Process` owns one.

/** How long a read may wait for data once proc has stopped waiting. */
const QUIET_MS = 100;

/**
 * A child's stdout. {@link ChildOutput.read} gives the chunks to the one
 * reader; {@link ChildOutput.exited} says the child has exited.
 *
 * Output nobody has started reading when the child exits is read into memory
 * then, so the pipe closes: a child run only for its status would otherwise
 * hold a file descriptor for as long as this process runs. It is still there
 * for a reader who comes later. A stream something else is already reading
 * (`process.stdout` read directly) is left alone.
 *
 * After a timeout, once the child has exited, a pause of `QUIET_MS` in the
 * output ends it: whatever still holds the pipe open is a program the child
 * started, which may run for good.
 *
 * @internal
 */
export class ChildOutput {
  #stream: ReadableStream<Uint8Array<ArrayBuffer>>;
  #reading = false;
  #pipe: PipeReader | undefined;
  #drained: Promise<Uint8Array<ArrayBuffer>[]> | undefined;

  constructor(stream: ReadableStream<Uint8Array<ArrayBuffer>>) {
    this.#stream = stream;
  }

  /** The chunks, to the end of the output. Read once. */
  async *read(): AsyncGenerator<Uint8Array<ArrayBuffer>> {
    this.#reading = true;
    if (this.#drained != null) {
      yield* await this.#drained;
    } else {
      this.#pipe ??= pipeReader(this.#stream);
      yield* this.#pipe.chunks;
    }
  }

  /** The child has exited; `timedOut` if proc stopped it for its timeout. */
  exited(timedOut: boolean): void {
    if (!this.#reading && !this.#stream.locked) {
      this.#pipe = pipeReader(this.#stream);
      this.#pipe.stopWaiting();
      this.#drained = Array.fromAsync(this.#pipe.chunks);
      this.#drained.catch(() => {});
    } else if (timedOut) {
      this.#pipe?.stopWaiting();
    }
  }
}

type PipeReader = {
  chunks: AsyncGenerator<Uint8Array<ArrayBuffer>>;
  stopWaiting(): void;
};

/** Read a stream; after `stopWaiting`, a read that waits `QUIET_MS` ends it. */
function pipeReader(
  stream: ReadableStream<Uint8Array<ArrayBuffer>>,
): PipeReader {
  const reader = stream.getReader();
  let waiting = false;
  let pending = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const giveUp = () => {
    timer = setTimeout(() => reader.cancel().catch(() => {}), QUIET_MS);
  };

  async function* chunks() {
    let done = false;
    try {
      while (true) {
        pending = true;
        if (waiting) giveUp();
        const result = await reader.read().finally(() => {
          pending = false;
          clearTimeout(timer);
        });
        if (result.done) {
          done = true;
          return;
        }
        yield result.value;
      }
    } finally {
      // Stopped early: closing the pipe tells the child no one is reading.
      if (!done) await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  }

  return {
    chunks: chunks(),
    stopWaiting() {
      if (waiting) return;
      waiting = true;
      if (pending) giveUp();
    },
  };
}
