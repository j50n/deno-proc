// The WebAssembly interface. Each streaming operation is a class behind an
// opaque handle that `*_new` returns. Nothing is ever freed: the JavaScript
// side makes one instance per stream and drops the instance when the stream
// ends (see Arena/arena.c). Sizes are Int32 because that is what crosses the
// boundary, and a nonzero `last` ends the stream.
//
// Pointers into buffers that grow (the reader's output and ends, the TSV
// converter's input and output) are valid until the next feed on the same
// handle, and so are views of memory, since a feed may grow it.
//
// A feed returns -1 once its input has had a byte refused, and the
// `invalid_*` functions, which take any handle, say which and where.

typealias Handle = UnsafeMutableRawPointer

@inline(__always)
private func with<T: AnyObject, R>(_ handle: Handle, _ body: (T) -> R) -> R {
    Unmanaged<T>.fromOpaque(handle)._withUnsafeGuaranteedRef(body)
}

private func retain(_ object: AnyObject) -> Handle {
    Unmanaged.passRetained(object).toOpaque()
}

// MARK: Any operation

@_expose(wasm, "invalid_row") @_cdecl("invalid_row")
func invalidRow(_ h: Handle) -> Int32 {
    with(h) { (o: StreamOperation) in Int32(truncatingIfNeeded: o.invalid.row) }
}

@_expose(wasm, "invalid_field") @_cdecl("invalid_field")
func invalidField(_ h: Handle) -> Int32 {
    with(h) { (o: StreamOperation) in Int32(truncatingIfNeeded: o.invalid.field) }
}

@_expose(wasm, "invalid_byte") @_cdecl("invalid_byte")
func invalidByte(_ h: Handle) -> Int32 {
    with(h) { (o: StreamOperation) in Int32(o.invalid.byte) }
}

/// 1 when the output format can't hold the byte, 0 when the input format
/// doesn't allow it where it was.
@_expose(wasm, "invalid_in_output") @_cdecl("invalid_in_output")
func invalidInOutput(_ h: Handle) -> Int32 {
    with(h) { (o: StreamOperation) in o.invalid.inOutput ? 1 : 0 }
}

// MARK: CSV and TSV reader

@_expose(wasm, "reader_new") @_cdecl("reader_new")
func readerNew(_ separator: Int32, _ quoting: Int32, _ chunkCapacity: Int32) -> Handle {
    retain(CSVReader(
        separator: UInt8(separator), quoting: quoting != 0, chunkCapacity: Int(chunkCapacity)))
}

@_expose(wasm, "reader_input") @_cdecl("reader_input")
func readerInput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (r: CSVReader) in r.input }
}

/// Bytes of complete rows at `reader_output`, or -1 once a CR is refused.
@_expose(wasm, "reader_feed") @_cdecl("reader_feed")
func readerFeed(_ h: Handle, _ count: Int32, _ last: Int32) -> Int32 {
    with(h) { (r: CSVReader) in Int32(r.feed(Int(count), last: last != 0)) }
}

@_expose(wasm, "reader_output") @_cdecl("reader_output")
func readerOutput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (r: CSVReader) in r.output.base }
}

/// Fields in the complete rows of the last feed.
@_expose(wasm, "reader_fields") @_cdecl("reader_fields")
func readerFields(_ h: Handle) -> Int32 {
    with(h) { (r: CSVReader) in Int32(r.rowFields) }
}

@_expose(wasm, "reader_byte_ends") @_cdecl("reader_byte_ends")
func readerByteEnds(_ h: Handle) -> UnsafeMutablePointer<UInt32> {
    with(h) { (r: CSVReader) in r.byteEnds.base }
}

@_expose(wasm, "reader_text_ends") @_cdecl("reader_text_ends")
func readerTextEnds(_ h: Handle) -> UnsafeMutablePointer<UInt32> {
    with(h) { (r: CSVReader) in r.textEnds.base }
}

// MARK: CSV to TSV

@_expose(wasm, "csv2tsv_new") @_cdecl("csv2tsv_new")
func csvToTSVNew(_ separator: Int32, _ chunkCapacity: Int32) -> Handle {
    retain(CSVToTSV(separator: UInt8(separator), chunkCapacity: Int(chunkCapacity)))
}

@_expose(wasm, "csv2tsv_input") @_cdecl("csv2tsv_input")
func csvToTSVInput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (c: CSVToTSV) in c.input }
}

@_expose(wasm, "csv2tsv_output") @_cdecl("csv2tsv_output")
func csvToTSVOutput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (c: CSVToTSV) in c.output }
}

/// Bytes at `csv2tsv_output`, or -1 once a byte is refused: a CR the CSV
/// doesn't allow, or a byte TSV can't hold.
@_expose(wasm, "csv2tsv_feed") @_cdecl("csv2tsv_feed")
func csvToTSVFeed(_ h: Handle, _ count: Int32, _ last: Int32) -> Int32 {
    with(h) { (c: CSVToTSV) in Int32(c.feed(Int(count), last: last != 0)) }
}

// MARK: TSV to CSV

@_expose(wasm, "tsv2csv_new") @_cdecl("tsv2csv_new")
func tsvToCSVNew(_ separator: Int32, _ crlf: Int32, _ chunkCapacity: Int32) -> Handle {
    retain(TSVToCSV(
        separator: UInt8(separator), crlf: crlf != 0, chunkCapacity: Int(chunkCapacity)))
}

/// Where to write the next chunk; it moves after every feed.
@_expose(wasm, "tsv2csv_input") @_cdecl("tsv2csv_input")
func tsvToCSVInput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (c: TSVToCSV) in c.nextChunk }
}

@_expose(wasm, "tsv2csv_output") @_cdecl("tsv2csv_output")
func tsvToCSVOutput(_ h: Handle) -> UnsafeMutablePointer<UInt8> {
    with(h) { (c: TSVToCSV) in c.output.base }
}

/// Bytes at `tsv2csv_output`, or -1 once a CR is refused.
@_expose(wasm, "tsv2csv_feed") @_cdecl("tsv2csv_feed")
func tsvToCSVFeed(_ h: Handle, _ count: Int32, _ last: Int32) -> Int32 {
    with(h) { (c: TSVToCSV) in Int32(c.feed(Int(count), last: last != 0)) }
}
