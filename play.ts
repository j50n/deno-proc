import { TextLineStream } from "https://deno.land/std@0.188.0/streams/mod.ts";

// class UpperStream extends TransformStream<string,string> {
//     constructor( {
//         transform: (chunk: string, _controller: TransformStreamDefaultController) => {
//             return  chunk.toUpperCase()
//         }
//     }){
//         super()
//     }
//     // async transform(chunk: string, controller: TransformStreamDefaultController){
//     //     console.dir(controller)
//     //     return await chunk.toUpperCase()
//     // }
// }

function toLines(
  input: ReadableStream<Uint8Array>,
): ReadableStream<Uint8Array> {
  let count = 0;

  return input.pipeThrough(new TextDecoderStream()).pipeThrough(
    new TextLineStream(),
  ).pipeThrough(
    new TransformStream<string, Uint8Array>({
      transform: (
        chunk: string,
        controller: TransformStreamDefaultController,
      ) => {
        if (count > 1000) {
          throw new Error("What happens when I do this?");
        }
        console.dir(count);
        controller.enqueue(
          new TextEncoder().encode(`${count++}. ${chunk.toUpperCase()}\n`),
        );
      },
    }),
  );
}

// function fromLines(input: AsyncIterableIterator<string>): WritableStream<Uint8Array> {

// }

// const command = new Deno.Command("ls", {cwd: "/home/dev", args: ["-la"], stdout: "piped"})

// const result = command.spawn()

// for await (const line of toLines(result.stdout)){
//     console.log(`-> ${line}`)
// }

// console.log(await result.status)

class CatchReadableStream<R> implements ReadableStream<R> {
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
  // deno-lint-ignore no-explicit-any
  getReader(
    options?: any,
  ): ReadableStreamBYOBReader | ReadableStreamDefaultReader<R> {
    return this.source.getReader(options);
  }
  pipeThrough<T>(
    transform: { writable: WritableStream<R>; readable: ReadableStream<T> },
    options?: PipeOptions,
  ): ReadableStream<T> {
    return this.source.pipeThrough(transform, options);
  }
  async pipeTo(dest: WritableStream<R>, options?: PipeOptions): Promise<void> {
    console.log("BLAH");
    await this.source.pipeTo(dest, options);
  }
  tee(): [ReadableStream<R>, ReadableStream<R>] {
    return this.source.tee();
  }
  [Symbol.asyncIterator](
    options?: { preventCancel?: boolean },
  ): AsyncIterableIterator<R> {
    return this.source[Symbol.asyncIterator](options);
  }
}

const file = await Deno.open("./warandpeace.txt");
try {
  // for await(const line of toLines(file.readable)){
  //     console.dir(line)
  // }
  const command0 = new Deno.Command("head", {
    args: ["-n", "50"],
    stdin: "piped",
    stdout: "piped",
  }).spawn();
  await toLines(file.readable).pipeTo(command0.stdin);

  const command1 = new Deno.Command("sort", { stdin: "piped" }).spawn();

  try {
    new CatchReadableStream(
      await command0.stdout.pipeThrough(
        new TransformStream<Uint8Array, Uint8Array>({
          transform: (chunk, controller) => {
            try {
              console.dir(
                "0000000000000000000000000000000000000000000000000000000000000000000",
              );
              controller.enqueue(chunk);
            } catch (e) {
              console.dir(
                "************-------------------------------------------------------------------------------------------------------",
              );
              throw e;
            }
          },

          flush: (controller) => {
            console.dir(
              "2222222222222222222222222222222222222222222222222222222222222222222222",
            );
            controller.enqueue(new Uint8Array(0));
          },
        }),
        { preventCancel: true },
      ),
    )
      .pipeTo(command1.stdin);
  } catch (e) {
    console.log("ERROR" + e.message);
  }

  console.dir(await command1.status);
} finally {
  //file.close();
}
