import { enumerate, read } from "@j50n/proc";
import { fromLazyRowBinary, toLazyRowBinary } from "@j50n/proc/transforms";

// Any string survives: separators, quotes, tabs, line breaks.
await enumerate([["1", 'a,"b"\tc\nd'], ["2", "\x1E\x1F"]])
  .transform(toLazyRowBinary())
  .writeTo("rows.lazyrow");

await read("rows.lazyrow")
  .transform(fromLazyRowBinary())
  .flatten()
  .forEach((row) => console.log(row.columnCount, row.toStringArray()));
