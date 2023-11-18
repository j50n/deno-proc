# Stderr and Error Handling

Standard input and standard output from a process are handled directly as
iterable data. There is a third data stream, standard error, that is a bit of an
outlier. Standard error is meant to be used either purely for error text from
the process or for some combination of logging and errors.

We are going to discuss how to handle standard error and how this relates to
error handling in the `proc` library. There are examples if you want to skip
ahead.

Default behavior of `stderr` and errors:

- all process `stderr` will be written to `Deno.stderr`
- any exit code other than 0 will throw an
  [`ExitCodeError`](https://deno.land/x/proc@{{gitv}}/mod.ts?s=ExitCodeError)
- if the process ends due to a signal, it will throw a
  [`SignalError`](https://deno.land/x/proc@{{gitv}}/mod.ts?s=SignalError)
- an error coming from upstream (`stdin`) will be wrapped in an
  [`UpstreamError`](https://deno.land/x/proc@{{gitv}}/mod.ts?s=UpstreamError)

While the default behaviors are usually adequate, these can be overridden. There
is no standard for standard error, so it may take some effort to get the results
you want.

## Taking Control of Stderr

You can capture stderr by defining `fnStderr` in the process options.
This example adds a timestamp and colors the stderr text red.

```typescript
const decoratedStderr: ProcessOptions<void> = {
  fnStderr: async (stderr) => {
    for await (const line of stderr.lines) {
      console.error(`${gray(new Date().toISOString())} ${red(line)}`);
    }
  },
};

await run(
  { ...decoratedStderr },
  "bash",
  "-c",
  `
    echo "This goes to stderr." >&2 
    echo "This goes to stdout."
  `,
).toStdout();
```

## Reinterpreting Process Errors

Catch and reinterpret exit code error, no stderr scraping.

## Throwing Errors based on Stderr

Scrape stderr to throw an error. Simple version. Mention the "contract" with
process that all lines of stdout should be printed, or logged, or something -
where ever you put it, make sure nothing gets dropped. So error goes at the end,
once all lines have been processed.

## Throwing Errors based on Stderr (Advanced)

Scrape stderr to throw an error. Full version.
