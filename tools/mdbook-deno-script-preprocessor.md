# `mdbook-deno-script-preprocessor`

Finds the first `<script>` tag, matches it with `</script>`. Treats the text in
between as a `javascript` module. The `default` export is called if one is
defined. It has to be a function that returns either `undefined` (void) or a
`string`. Otherwise the module is run for side effect only.

I chose the `<script>` tag because this already is colored properly, and you
would hardly ever use this as direct input. If you did, you could use
`<script type="...">` as an alternative. That would not be imported and
executed. It is a hack that almost makes this look designed.

Runs may be done concurrently. The concurrency is at the `chapter` level (one
file in the markdown). This can be done safely using the global `window` object
if you are careful.

Results are cached and reused at the chapter level. If you are editing, anything
where the source is changing will invalidate the cached results. Anything where
the source is stable will be reused from cache. You can set the cache timeout
pretty low and still get good performance in most cases. For very complex
documents, a longer timeout will allow you to keep your sanity.

Secure-by-default of Deno is amazing here. If you don't allow file writes, for
example, you can't accidentally write a script that will corrupt your file
system. Since the code is being executed fairly regularly (automatic saves in
`vscode`), you want any protection from mistakes you can get.
