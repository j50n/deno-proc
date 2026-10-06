# The flatdata CLI

`flatdata` converts between CSV, TSV, and the record format on the command line.
Put it in front of a program, and the program reads simple records instead of
CSV, with the parsing done in another process.

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

| Command                    | Options                                |
| -------------------------- | -------------------------------------- |
| `csv2record`, `csv2tsv`    | `-d <char>` CSV separator, default `,` |
| `tsv2csv`, `record2csv`    | `-d <char>`, `--crlf`                  |
| `tsv2record`, `record2tsv` | none                                   |

`--crlf` ends rows with CRLF. The commands are the library's transforms behind a
command line: `csv2tsv` is `csvToTsv()`, `csv2record` is `fromCsvToRows()` into
`toRecord()`, and so on. So they read and refuse what the library does, its
parsers read flatdata's output, and its writers make flatdata's input.

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
`.lines`.

## Errors

A field the output format can't hold stops the conversion, as the library's
writers do: a tab, CR, or LF for TSV, `\x1E` or `\x1F` for the record format. So
does a row the output would lose, a CR in CSV or TSV input that isn't part of a
CRLF, and a CSV quote still open at the end of the input. flatdata prints the
message to stderr as one line naming the row and field, as in
`flatdata: Invalid character (tab) in TSV data at row 2, field 1`, and exits
with code 1, which proc turns into an `ExitCodeError`:

```typescript
{{#include ../../examples/data/flatdata-limits.ts}}
```

```text
{{#include ../../examples/data/flatdata-limits.out}}
```

Output written before the error stays, and can end partway through a row; here
there was none. `-d` must be one ASCII character other than `"`, CR, or LF.

`-o` naming the file it reads, by `-i` or by `<`, is an error before anything is
written, whatever path or symlink names it: opening the output would empty the
input. When the reader of its output goes away, as with `| head`, flatdata stops
and exits with 0, as other commands do.

Invalid UTF-8 stops the commands that make rows (`csv2record`, `tsv2record`,
`record2csv`, `record2tsv`) with a `TypeError`. `csv2tsv` and `tsv2csv` copy
bytes without decoding them, so they pass it through unchanged.
