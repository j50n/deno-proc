# Type-Template for mdbook

**This is work in progress.** Usable but likely to change.

## Installation

You need a recent version of Deno. Refer to the
[Deno Manual](https://deno.com/manual@v1.34.3/getting_started/installation).

The preprocessor requires no additional installation. It runs from URL.

## Configuration

Add the following to `book.toml`:

```toml
[preprocessor.type-template]
command = "deno run --allow-read=. https://deno.land/x/proc@0.20.30/tools/type-template.ts"
output-to-file = false
```

If your script requires more permissions, you will need to add those to the
`deno run` command. Deno is secure by default. Disk access (read or write),
network access, and ability to see environment variables all require explicit
permissions.

The preprocessor script is fully sandboxed by default, requiring no defined
permissions to run - as long as you aren't doing things in your own scripts that
require those permissions. Even the `--allow-read` is optional, but required if
you are doing dynamic imports.

## Limitations on `stdout` Usage

USe `console.error()` for logging out information. `stdout` is reserved. Any
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

This needs to implement caching so that active content is not **all** updated on
every edit, but it is okay update just the page that is being changed. I can
probably do this with safe data storage.
