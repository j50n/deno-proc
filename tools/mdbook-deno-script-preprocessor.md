# Type-Template for mdbook

**This is work in progress.** Usable but likely to change.

## Installation

You need a recent version of Deno. Refer to the
[Deno Manual](https://deno.com/manual/getting_started/installation).

The preprocessor requires no additional installation. It runs from URL.

## Getting Help

The preprocessor is a command-line application. You can get help in the terminal
by adding the `--help` flag.

```bash
deno --unstable run \
  https://deno.land/x/proc/tools/mdbook-deno-script-preprocessor.ts \
  --help
```

## Configuration

Add the following to `book.toml`:

```toml
[preprocessor.type-template]
command = "deno --unstable run --allow-read=. https://deno.land/x/proc/tools/mdbook-deno-script-preprocessor.ts process --concurrently --cache-duration=24.0"
output-to-file = false
```

Flags `--allow-read`, `--concurrently` and `--cache-duration` are optional.

## Permissions

Deno is secure by default. This means that if you don't explicitly give
permission, the scripts won't be able to write to file, delete folders, etc.
This is a _very good_ thing. The sandbox prevents you from accidentally causing
havoc as you use scripts in your documents.

I recommend you avoid giving your scripts the ability to write files. Network
access should be restricted as much as possible. The ability to run processes
should be minimal. The ability to read certain environment variables could
expose secrets depending on your environment. This protects you from making
mistakes that damage your environment. **Limit access as much as you can.** When
allowing access, do so for specific folders, web addresses, processes, and
environment variables rather than opening up permissions completely.

If your script requires more permissions, you will need to add those to the
`deno run` command.

The preprocessor script is fully sandboxed by default, requiring no defined
permissions to run.

## Limitations on `stdout` Usage

Use `console.error()` for logging out information. `stdout` is reserved. Any
writes to `stdout` will break the preprocessor.

## Use

This will import undecorated script tags in your markdown as modules and execute
the default export. Example:

```javascript
<script>
  export default () => "This text is included in the document.";
</script>;
```

The text (`string`) data returned from the function will be inserted into the
markdown.

Modules in the markdown are `JavaScript` - and **not** `Typescript`. The
intended strategy is to keep the markdown code very light and do the middle and
heavy-weight stuff in dynamically imported local `Typescript` modules.

### Chapter Context

A context object is passed in for each chapter. You can modify this object to
pass data from one module to the next. In this example, the value `count` is
being defined as `1` on the context object.

```javascript
<script>
export default (context) => {
    context.count = 1;
    return "This text is included in the document.";
}
</script>
```

Chapter context comes pre-loaded with the following:

| name | type               | description                                                                  |
| ---- | ------------------ | ---------------------------------------------------------------------------- |
| path | (string) => string | Converts a relative path based at the book root into absolute file URL path. |

To set globals, use the standard `window` global object.

### Local Imports

Standard imports don't work with relative paths. Instead, use a dynamic import
with the passed-in context:

```javascript
<script>
export default (context) => {
    const util = await import(context.path("./lib/util.ts"));
    return util.someUtilityThing("something");
}
</script>
```

Note that the path is relative to the _root_ book folder, not the folder where
the markdown is defined.

## Caching

By default, the preprocessor caches the results of executing scripts on pages
where the source isn't changing (being edited) for 24 hours.

To clear the cache from command line:

```bash
deno --unstable run \
  https://deno.land/x/proc/tools/mdbook-deno-script-preprocessor.ts \
  clear-cache
```
