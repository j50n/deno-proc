# Playing Sounds with `aplay`

Did you ever wonder if there were an easy way to play sounds in Deno?

Deno does not yet support the Web Audio API, so our ability to play sounds
natively is limited. Fortunately, `aplay` is available (at least on Ubuntu)
without requiring an install.

Programs that are written in `C`, like `aplay`, start up very quickly and run
efficiently. You can play a sound - or even multiple sounds at the same time -
without missing a beat. The example demonstrates this. The one caveat is IO
speed - if you are loading sounds from something other than memory. The example
downloads the sounds it will need into memory first, before it attempts to play
them. The WAV files are streamed through `stdin` to `aplay` using buffered,
non-blocking IO.

Have fun!

[sounds.ts](./sounds.ts)
