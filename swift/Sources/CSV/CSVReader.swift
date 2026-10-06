/// Reads CSV, or TSV with `quoting` off, in chunks and hands back whole
/// rows, with the position of every field's end.
///
/// The rows come out in record format: each field ends in 0x1F except the
/// last of a row, which ends in 0x1E. Field i spans from just past terminator
/// i - 1 (or 0) to terminator i, and:
/// - `byteEnds[i]` is terminator i's offset in `output`;
/// - `textEnds[i]` is its offset in UTF-16 code units in the decoded output,
///   which holds while the input is valid UTF-8.
///
/// So the caller can decode a whole batch with one call and slice fields out
/// of it by `textEnds`, or compare and decode single fields by `byteEnds`.
/// Field content keeps any 0x1E and 0x1F it had, so the ends, not a split on
/// those bytes, say where fields are.
///
/// After each `feed`, the front of `output` holds `rowBytes` bytes and
/// `rowFields` terminators of complete rows, and nothing else the caller
/// should read. A row cut off by the end of the chunk stays behind them and
/// moves to the front at the next feed, so a row never straddles two outputs.
/// A row longer than a chunk just makes `output` grow.
///
/// `output`, `byteEnds` and `textEnds` may move at every feed; the caller
/// reads their addresses afterwards. `input` stays put.
final class CSVReader {
    let chunkCapacity: Int
    /// Where the caller writes each chunk of at most `chunkCapacity` bytes.
    let input: UnsafeMutablePointer<UInt8>
    private(set) var output: GrowableBuffer<UInt8>
    private(set) var byteEnds: GrowableBuffer<UInt32>
    private(set) var textEnds: GrowableBuffer<UInt32>
    private var lexer: CSVLexer

    /// Bytes and terminators of the complete rows at the front of `output`.
    private(set) var rowBytes = 0
    private(set) var rowFields = 0
    /// The partial row right after them, carried into the next feed.
    private var partialBytes = 0
    private var partialFields = 0
    /// The lexer's `utf8Excess` at offset 0 of `output`.
    private var excessBase = 0

    init(separator: UInt8, quoting: Bool, chunkCapacity: Int) {
        self.chunkCapacity = chunkCapacity
        input = .allocate(capacity: chunkCapacity + scanPadding)
        output = GrowableBuffer(capacity: chunkCapacity + 1 + copySlack)
        byteEnds = GrowableBuffer(capacity: chunkCapacity + 1)
        textEnds = GrowableBuffer(capacity: chunkCapacity + 1)
        lexer = CSVLexer(separator: separator, quoting: quoting)
    }

    /// Reads `count` bytes from `input` and returns `rowBytes`. When `last`,
    /// the stream ends here, and every byte of output is in complete rows.
    func feed(_ count: Int, last: Bool) -> Int {
        // Every input byte makes at most one output byte or terminator, and
        // the end of the stream one more terminator.
        carryPartialRow(incoming: count + 1)
        var sink = IndexingRecordWriter(
            out: output.base, count: partialBytes,
            byteEnds: byteEnds.base, textEnds: textEnds.base, fields: partialFields,
            excessBase: excessBase)
        var lexer = self.lexer
        lexer.scan(input, count: count, into: &sink)
        if last { lexer.finish(into: &sink) }
        self.lexer = lexer
        rowBytes = sink.completeBytes
        partialBytes = sink.count - rowBytes
        rowFields = sink.completeFields
        partialFields = sink.fields - rowFields
        return rowBytes
    }

    /// Drops the rows the caller has seen, moves the partial row to the front,
    /// and makes room for `incoming` more bytes and terminators.
    private func carryPartialRow(incoming: Int) {
        if rowFields > 0 {
            output.moveToFront(from: rowBytes, count: partialBytes)
            let rowText = Int(textEnds.base[rowFields - 1]) + 1
            for i in 0..<partialFields {
                byteEnds.base[i] = byteEnds.base[rowFields + i] &- UInt32(rowBytes)
                textEnds.base[i] = textEnds.base[rowFields + i] &- UInt32(rowText)
            }
            excessBase = excessBase &+ (rowBytes - rowText)
            rowBytes = 0
            rowFields = 0
        }
        byteEnds.reserve(partialFields + incoming, keeping: partialFields)
        textEnds.reserve(partialFields + incoming, keeping: partialFields)
        output.reserve(partialBytes + incoming + copySlack, keeping: partialBytes)
    }
}

/// Writes record format into a buffer with room for everything it's given,
/// and records where each terminator lands, in bytes and in UTF-16 code units.
struct IndexingRecordWriter: CSVSink {
    static var tracksText: Bool { true }

    let out: UnsafeMutablePointer<UInt8>
    var count: Int
    let byteEnds: UnsafeMutablePointer<UInt32>
    let textEnds: UnsafeMutablePointer<UInt32>
    var fields: Int
    /// The lexer's `utf8Excess` at offset 0 of `out`.
    let excessBase: Int
    /// Output and terminators up to and including the last row's end.
    var completeBytes = 0
    var completeFields = 0

    init(
        out: UnsafeMutablePointer<UInt8>, count: Int,
        byteEnds: UnsafeMutablePointer<UInt32>, textEnds: UnsafeMutablePointer<UInt32>,
        fields: Int, excessBase: Int
    ) {
        self.out = out
        self.count = count
        self.byteEnds = byteEnds
        self.textEnds = textEnds
        self.fields = fields
        self.excessBase = excessBase
    }

    @inline(__always)
    mutating func content(_ bytes: UnsafePointer<UInt8>, count n: Int) {
        copyWithSlack(out + count, bytes, n)
        count &+= n
    }

    @inline(__always)
    mutating func byte(_ b: UInt8) {
        out[count] = b
        count &+= 1
    }

    @inline(__always)
    private mutating func terminate(_ terminator: UInt8, utf8Excess: Int) {
        byteEnds[fields] = UInt32(truncatingIfNeeded: count)
        textEnds[fields] = UInt32(truncatingIfNeeded: count &- (utf8Excess &- excessBase))
        fields &+= 1
        byte(terminator)
    }

    @inline(__always)
    mutating func fieldEnd(utf8Excess: Int) {
        terminate(ASCII.unitSeparator, utf8Excess: utf8Excess)
    }

    @inline(__always)
    mutating func rowEnd(utf8Excess: Int) {
        terminate(ASCII.recordSeparator, utf8Excess: utf8Excess)
        completeBytes = count
        completeFields = fields
    }
}
