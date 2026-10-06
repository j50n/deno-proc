# The CSV Reader

proc's CSV and TSV transforms, and the flatdata CLI, read with one streaming
reader written in Embedded Swift and compiled to a WebAssembly module of about
10 KB with no imports. The source is in `swift/` in the repository; the doc
comments there carry the details.

## How it reads CSV

It follows [RFC 4180](https://datatracker.ietf.org/doc/html/rfc4180) and is
lenient where the RFC leaves room or the input breaks it. Nothing but invalid
UTF-8 is an error.

| Input                               | Result                                 |
| ----------------------------------- | -------------------------------------- |
| `"a, b"` (quoted separator)         | `a, b`                                 |
| `"say ""hi"""` (doubled quote)      | `say "hi"`                             |
| `"two` LF `lines"`                  | the newline is kept                    |
| `ab"c` (quote inside a field)       | `ab"c`: the quote is content           |
| `"a"b` (text after a closing quote) | `ab`                                   |
| CR outside quotes                   | dropped, so CRLF reads like LF         |
| blank line                          | no row                                 |
| `""` alone on a line                | a row of one empty field               |
| a quote still open at the end       | the field ends there, with what it had |
| rows of different lengths           | read as they are                       |
| UTF-8 byte order mark at the start  | dropped                                |

The separator can be any ASCII character other than a quote, CR or LF. TSV is
the same reader with a tab separator and quoting off, so in TSV a quote is an
ordinary character and every CR is dropped.

## How it works

Chunks of input of any size go into the reader, and whole rows come out: a row
cut off by the end of a chunk waits for the next one. For each batch of rows,
the reader hands JavaScript the field bytes and the end of every field, in bytes
and in UTF-16 code units. JavaScript then decodes the whole batch with one
`TextDecoder` call and slices fields out of the string, or, for LazyRows,
decodes or compares single fields only when asked.

Inside, the reader is a four-state machine (field start, unquoted, quoted, quote
in quoted) that visits only the bytes that can change its state: quotes,
separators, CR and LF. It finds them 64 bytes at a time with wasm SIMD, and
copies the runs between them 16 bytes at a time.

`csvToTsv()` and `tsvToCsv()` use the same machinery to convert bytes to bytes
without ever making a JavaScript string.
