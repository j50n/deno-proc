# The flatdata CLI

`flatdata` converts between CSV, TSV, the record format, and the LazyRow binary
format on the command line. Put it in front of a program, and the program reads
simple records instead of CSV, with the parsing done in another process.

```sh
cat data.csv | flatdata csv2record | ./process | flatdata record2csv > out.csv
```

Install it with Deno:

```sh
deno install -g --allow-read --allow-write -n flatdata jsr:@j50n/proc@{{gitv}}/flatdata
```

The permissions are for `-i` and `-o`; without them it still works on stdin and
stdout. To run it without installing,
`deno run jsr:@j50n/proc@{{gitv}}/flatdata csv2tsv < data.csv`.
`flatdata --help` lists the commands, and `flatdata <command> --help` a
command's options.

## Commands

Commands are named `<from>2<to>`. Each reads stdin and writes stdout, or
`-i <file>` and `-o <file>`.

| Command                                           | Options                                 |
| ------------------------------------------------- | --------------------------------------- |
| `csv2record`, `csv2tsv`, `csv2lazyrow`            | `-d <char>` CSV separator, default `,`  |
| `tsv2csv`, `record2csv`                           | `-d <char>`, `--always-quote`, `--crlf` |
| `lazyrow2csv`                                     | `-d <char>`                             |
| `tsv2record`, `tsv2lazyrow`, `record2tsv`         | none                                    |
| `record2lazyrow`, `lazyrow2record`, `lazyrow2tsv` | none                                    |

`--always-quote` quotes every field rather than only those that need it, and
`--crlf` ends rows with CRLF. The formats are the ones `@j50n/proc/transforms`
reads and writes, so its parsers read flatdata's output and its writers make
flatdata's input.

## In a pipeline

```typescript
{{#include ../../examples/data/flatdata-pipeline.ts}}
```

```text
{{#include ../../examples/data/flatdata-pipeline.out}}
```

With flatdata installed, write `.run("flatdata", "csv2record")`. The parsing
then runs in its own process, alongside your program instead of in it. Records
end in `\x1E`, not newlines, so read them with `fromRecordToRows()`, not
`.lines`. `csv2lazyrow` with `fromLazyRowBinary()` works the same way.

## Limits

flatdata doesn't check fields, and doesn't report bad CSV:

```typescript
{{#include ../../examples/data/flatdata-limits.ts}}
```

```text
{{#include ../../examples/data/flatdata-limits.out}}
```

- `csv2tsv` writes a tab or line break inside a field as it is, and `csv2record`
  the same for `\x1E` and `\x1F`, so the output has more fields or rows than the
  input. The library's `toTsv()` and `toRecord()` throw instead.
- `lazyrow2csv` doesn't quote: a field holding a comma comes out as two. Use
  `lazyrow2record` and then `record2csv`.
- A CSV field with text after its closing quote (`"x" ,y`) stops parsing, as in
  the library ([the silent-stop bug](./csv.md#the-silent-stop-bug)), but worse:
  the output is cut short, often to nothing, and the exit code is 0.
- `csv2record` and `csv2tsv` use a different parser from the library's: a blank
  line ending in CRLF becomes an empty record (an empty line in TSV), where an
  LF blank line is skipped.
- In `csv2record` and `csv2tsv`, a row of more than 2 MiB is cut off at 2 MiB
  without its row end, and rows after it can be lost, all with exit code 0.
- `-d` takes the first character of what you pass and isn't checked; an empty
  `-d ''` means `,`.

These are why the pipeline example above reads data it trusts. For CSV from
elsewhere, parse it in your program with a parser that reports errors; see
[CSV](./csv.md).
