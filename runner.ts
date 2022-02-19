import { RunnerImpl } from "./runner-impl.ts";
import { bytesInput, bytesOutput } from "./runners/handlers/bytes.ts";
import { emptyInput, emptyOutput } from "./runners/handlers/empty.ts";
import { stringInput, stringOutput } from "./runners/handlers/string.ts";
import { stringArrayOutput } from "./runners/handlers/string-array.ts";
import {
  Group,
  group,
  InputHandler,
  OutputHandler,
  RunOptions,
} from "./runners/proc-group.ts";
import { LINESEP } from "./runners/constants.ts";
import { concat } from "./runners/utility.ts";
import { bytesAsyncIterableInput } from "./runners/handlers/bytes-asynciterable.ts";
import { readerInput } from "./runners/handlers/reader.ts";

const globalGroup = group();

/** Something that is either a promise or an iterable. */
export type PromiseOrIterable<B> = B extends AsyncIterable<unknown> ? B
  : Promise<B>;

export interface Runner<A, B> {
  /**
   * Run a command.
   * @param options Run options.
   * @param input Input data.
   */
  run(
    options: RunOptions,
    input?: A,
  ): PromiseOrIterable<B>;
}

/**
 * Define a reusable process runner.
 * @param input Handler for the input to the process.
 * @param output Handler for the output from the process.
 * @returns A process runner.
 */
export function runner<A, B>(
  input: InputHandler<A>,
  output: OutputHandler<B>,
): (group?: Group) => Runner<A, B> {
  return (group?: Group) => new RunnerImpl(group || globalGroup, input, output);
}

type StandardInputs =
  | string
  | Uint8Array
  | string[]
  | Uint8Array[]
  | Iterable<string>
  | Iterable<Uint8Array>
  | AsyncIterable<string>
  | AsyncIterable<Uint8Array>
  | Deno.Reader & Deno.Closer
  | undefined;

export async function run0(
  options: RunOptions,
  input?: StandardInputs,
): Promise<void> {
  await runSomething(emptyOutput(), options, input);
}

export async function runS(
  options: RunOptions,
  input?: StandardInputs,
): Promise<string> {
  return await runSomething(stringOutput(), options, input);
}

export async function runB(
  options: RunOptions,
  input?: StandardInputs,
): Promise<Uint8Array> {
  return await runSomething(bytesOutput(), options, input);
}

export async function runSa(
  options: RunOptions,
  input?: StandardInputs,
): Promise<string[]> {
  return await runSomething(stringArrayOutput(), options, input);
}

// deno-lint-ignore no-explicit-any
function isIterable(x: any): x is Iterable<unknown> {
  return Symbol.iterator in x;
}

// deno-lint-ignore no-explicit-any
function isAsyncIterable(x: any): x is Iterable<unknown> {
  return Symbol.asyncIterator in x;
}

// deno-lint-ignore no-explicit-any
function isReaderCloser(x: any): x is Deno.Reader & Deno.Closer {
  return typeof x.read === "function" && typeof x.close === "function";
}

function runSomething<B>(
  output: OutputHandler<B>,
  options: RunOptions,
  input?: StandardInputs,
): PromiseOrIterable<B> {
  if (input === undefined) {
    return new RunnerImpl(globalGroup, emptyInput(), output).run(
      options,
    );
  } else if (typeof input === "string") {
    return new RunnerImpl(globalGroup, stringInput(), output).run(
      options,
      input,
    );
  } else if (input instanceof Uint8Array) {
    return new RunnerImpl(globalGroup, bytesInput(), output).run(
      options,
      input,
    );
  } else if (Array.isArray(input)) {
    return new RunnerImpl(globalGroup, bytesAsyncIterableInput(), output)
      .run(
        options,
        genericArrayInput(input),
      );
  } else if (isIterable(input)) {
    return new RunnerImpl(globalGroup, bytesAsyncIterableInput(), output)
      .run(
        options,
        genericAsyncIterableInput(
          iterableToAsyncIterable(input as Iterable<string | Uint8Array>),
        ),
      );
  } else if (isAsyncIterable(input)) {
    return new RunnerImpl(globalGroup, bytesAsyncIterableInput(), output)
      .run(
        options,
        genericAsyncIterableInput(input as AsyncIterable<string | Uint8Array>),
      );
  } else if (isReaderCloser(input)) {
    return new RunnerImpl(globalGroup, readerInput(), output)
      .run(
        options,
        input as Deno.Reader & Deno.Closer,
      );
  } else {
    throw new TypeError("input is not a supported type");
  }
}

async function* iterableToAsyncIterable<T>(
  input: Iterable<T>,
): AsyncIterableIterator<T> {
  for (const item of input) {
    yield item;
  }
}

async function* genericArrayInput(
  input: (string | Uint8Array)[],
): AsyncIterableIterator<Uint8Array> {
  const encoder = new TextEncoder();
  const linesep = encoder.encode(LINESEP);

  for (const item of input) {
    if (typeof item === "string") {
      yield concat([encoder.encode(item), linesep]);
    } else if (item instanceof Uint8Array) {
      yield item;
    } else {
      throw new TypeError("item is not a 'string' or 'Uint8Array'");
    }
  }
}

async function* genericAsyncIterableInput(
  input: AsyncIterable<string | Uint8Array>,
): AsyncIterableIterator<Uint8Array> {
  const encoder = new TextEncoder();
  const linesep = encoder.encode(LINESEP);

  for await (const item of input) {
    if (typeof item === "string") {
      yield concat([encoder.encode(item), linesep]);
    } else if (item instanceof Uint8Array) {
      yield item;
    } else {
      throw new TypeError("item is not a 'string' or 'Uint8Array'");
    }
  }
}
