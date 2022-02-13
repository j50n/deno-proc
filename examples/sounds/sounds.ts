#!/usr/bin/env -S deno run --allow-run=aplay --allow-net=github.com,raw.githubusercontent.com

import * as proc from "../../mod.ts";

/**
 * Grab the sound files from my github repository.
 * @param name The name of the sound.
 * @returns The WAV file.
 */
async function getSoundFile(name: string): Promise<Uint8Array> {
  const url =
    `https://github.com/j50n/deno-proc/blob/main/examples/sounds/${name}.wav?raw=true`;
  return new Uint8Array(await (await fetch(url)).arrayBuffer());
}

/**
 * Play a sound using `aplay`.
 * @param sound A WAV file.
 */
async function play(sound: Uint8Array): Promise<void> {
  for await (
    const line of proc.runner(
      proc.bytesInput(),
      proc.stringIterableUnbufferedOutput(),
    )().run({ cmd: ["aplay"] }, sound)
  ) {
    console.log(line);
  }
}

const [cowWav, cowbellWav] = await Promise.all([
  getSoundFile("cow"),
  getSoundFile("cowbell"),
]);

console.log(`MOO sound is ${cowWav.length} bytes.`);
console.log(`Bell sound is ${cowbellWav.length} bytes.`);

/* Moo. */
await play(cowWav);
await proc.sleep(100);

/* Ring a bell. */
await play(cowbellWav);
await proc.sleep(100);

/* Moo and ring a bell. */
await Promise.all([play(cowWav), play(cowbellWav)]);
await proc.sleep(100);
